import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import {
  buscarConflito,
  buscarReservaNoMesmoDia,
} from '../src/lib/regras/conflito'

/**
 * Testes da checagem de conflito contra um banco de verdade.
 *
 * A sobreposição é resolvida por uma query SQL, não por código TypeScript —
 * testá-la com objetos em memória validaria a coisa errada. Cada execução usa
 * um arquivo SQLite próprio, criado a partir das mesmas migrations do projeto
 * e apagado ao final, para não tocar no dev.db.
 */
const ARQUIVO = path.join(process.cwd(), 'prisma', 'test-conflito.db')

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: `file:${ARQUIVO}` }),
})

const DATA = '2026-09-07'

async function aplicarMigrations() {
  const dir = path.join(process.cwd(), 'prisma', 'migrations')

  for (const pasta of readdirSync(dir).filter((p) => !p.startsWith('migration_lock')).sort()) {
    const sql = path.join(dir, pasta, 'migration.sql')
    const conteudo = readFileSync(sql, 'utf8')

    // O executeRawUnsafe roda um comando por vez.
    for (const comando of conteudo.split(';').map((c) => c.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(comando)
    }
  }
}

function reserva(over: Partial<Record<string, string>> = {}) {
  return {
    nomeSolicitante: 'Fulano de Tal',
    dataNascimento: '1990-01-01',
    telefone: '11999999999',
    email: 'fulano@exemplo.com',
    tipoVinculo: 'NAO_MEMBRO',
    espaco: 'QUADRA_SOCIETY',
    data: DATA,
    horaInicio: '19:00',
    horaFim: '21:00',
    finalidade: 'Teste automatizado.',
    status: 'PENDENTE',
    ...over,
  }
}

before(async () => {
  rmSync(ARQUIVO, { force: true })
  await aplicarMigrations()
})

after(async () => {
  await prisma.$disconnect()
  rmSync(ARQUIVO, { force: true })
})

describe('conflito de horário e espaço', () => {
  it('detecta sobreposição parcial', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva() }) // 19:00–21:00

    // 20:00–22:00 invade a última hora da existente.
    const c = await buscarConflito(prisma, {
      espaco: 'QUADRA_SOCIETY',
      data: DATA,
      horaInicio: '20:00',
      horaFim: '22:00',
    })
    assert.notEqual(c, null)
  })

  it('detecta um período que engloba o outro', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva({ horaInicio: '19:30', horaFim: '20:30' }) })

    const c = await buscarConflito(prisma, {
      espaco: 'QUADRA_SOCIETY',
      data: DATA,
      horaInicio: '19:00',
      horaFim: '21:00',
    })
    assert.notEqual(c, null)
  })

  it('NÃO acusa conflito em reservas encostadas', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva({ horaInicio: '19:00', horaFim: '21:00' }) })

    // Começa exatamente quando a outra termina: o espaço já está livre.
    const c = await buscarConflito(prisma, {
      espaco: 'QUADRA_SOCIETY',
      data: DATA,
      horaInicio: '21:00',
      horaFim: '23:00',
    })
    assert.equal(c, null)
  })

  it('não confunde espaços diferentes', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva() })

    const c = await buscarConflito(prisma, {
      espaco: 'CAMPO_FUTEBOL',
      data: DATA,
      horaInicio: '19:00',
      horaFim: '21:00',
    })
    assert.equal(c, null)
  })

  it('não confunde datas diferentes', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva() })

    const c = await buscarConflito(prisma, {
      espaco: 'QUADRA_SOCIETY',
      data: '2026-09-08',
      horaInicio: '19:00',
      horaFim: '21:00',
    })
    assert.equal(c, null)
  })

  it('libera o horário quando a reserva é rejeitada ou cancelada', async () => {
    for (const status of ['REJEITADO', 'CANCELADO']) {
      await prisma.reserva.deleteMany()
      await prisma.reserva.create({ data: reserva({ status }) })

      const c = await buscarConflito(prisma, {
        espaco: 'QUADRA_SOCIETY',
        data: DATA,
        horaInicio: '19:00',
        horaFim: '21:00',
      })
      assert.equal(c, null, `status ${status} não deveria ocupar o espaço`)
    }
  })

  it('bloqueia contra reservas pendentes, aprovadas e confirmadas', async () => {
    for (const status of ['PENDENTE', 'APROVADO', 'CONFIRMADO']) {
      await prisma.reserva.deleteMany()
      await prisma.reserva.create({ data: reserva({ status }) })

      const c = await buscarConflito(prisma, {
        espaco: 'QUADRA_SOCIETY',
        data: DATA,
        horaInicio: '19:00',
        horaFim: '21:00',
      })
      assert.notEqual(c, null, `status ${status} deveria ocupar o espaço`)
    }
  })

  it('ignora a própria reserva ao reavaliar', async () => {
    await prisma.reserva.deleteMany()
    const r = await prisma.reserva.create({ data: reserva() })

    const c = await buscarConflito(prisma, {
      espaco: 'QUADRA_SOCIETY',
      data: DATA,
      horaInicio: '19:00',
      horaFim: '21:00',
      ignorarId: r.id,
    })
    assert.equal(c, null)
  })
})

describe('limite de 1 reserva por responsável por dia', () => {
  it('acusa o mesmo e-mail no mesmo dia, mesmo em outro espaço', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva({ espaco: 'CAMPO_FUTEBOL' }) })

    const existente = await buscarReservaNoMesmoDia(prisma, {
      email: 'fulano@exemplo.com',
      data: DATA,
    })
    assert.notEqual(existente, null)
  })

  it('permite o mesmo e-mail em datas diferentes', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva() })

    const existente = await buscarReservaNoMesmoDia(prisma, {
      email: 'fulano@exemplo.com',
      data: '2026-09-08',
    })
    assert.equal(existente, null)
  })

  it('não conta reservas canceladas contra o limite', async () => {
    await prisma.reserva.deleteMany()
    await prisma.reserva.create({ data: reserva({ status: 'CANCELADO' }) })

    const existente = await buscarReservaNoMesmoDia(prisma, {
      email: 'fulano@exemplo.com',
      data: DATA,
    })
    assert.equal(existente, null)
  })
})
