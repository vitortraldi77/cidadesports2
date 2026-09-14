import 'dotenv/config'
import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  buscarConflito,
  buscarReservaNoMesmoDia,
} from '../src/lib/regras/conflito'

/**
 * Testes da checagem de conflito contra um banco de verdade.
 *
 * A sobreposição é resolvida por uma query SQL, não por código TypeScript —
 * testá-la com objetos em memória validaria a coisa errada.
 *
 * Corre contra TEST_DATABASE_URL, NUNCA contra DATABASE_URL: cada teste
 * começa com `deleteMany()`, e rodar isso contra o banco de produção
 * apagaria reservas de verdade. Sem TEST_DATABASE_URL configurada — uma
 * branch de teste do Neon, por exemplo, criada em vercel.com/<time>/stores —
 * a suíte é pulada com um aviso, em vez de arriscar o banco em produção.
 */
const TEST_URL = process.env.TEST_DATABASE_URL

const prisma = TEST_URL
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_URL }) })
  : null

const DATA = '2026-09-07'

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

if (prisma) {
  const db = prisma

  after(async () => {
    await db.reserva.deleteMany()
    await db.$disconnect()
  })

  describe('conflito de horário e espaço', () => {
    it('detecta sobreposição parcial', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva() }) // 19:00–21:00

      // 20:00–22:00 invade a última hora da existente.
      const c = await buscarConflito(db, {
        espaco: 'QUADRA_SOCIETY',
        data: DATA,
        horaInicio: '20:00',
        horaFim: '22:00',
      })
      assert.notEqual(c, null)
    })

    it('detecta um período que engloba o outro', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva({ horaInicio: '19:30', horaFim: '20:30' }) })

      const c = await buscarConflito(db, {
        espaco: 'QUADRA_SOCIETY',
        data: DATA,
        horaInicio: '19:00',
        horaFim: '21:00',
      })
      assert.notEqual(c, null)
    })

    it('NÃO acusa conflito em reservas encostadas', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva({ horaInicio: '19:00', horaFim: '21:00' }) })

      // Começa exatamente quando a outra termina: o espaço já está livre.
      const c = await buscarConflito(db, {
        espaco: 'QUADRA_SOCIETY',
        data: DATA,
        horaInicio: '21:00',
        horaFim: '23:00',
      })
      assert.equal(c, null)
    })

    it('não confunde espaços diferentes', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva() })

      const c = await buscarConflito(db, {
        espaco: 'CAMPO_FUTEBOL',
        data: DATA,
        horaInicio: '19:00',
        horaFim: '21:00',
      })
      assert.equal(c, null)
    })

    it('não confunde datas diferentes', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva() })

      const c = await buscarConflito(db, {
        espaco: 'QUADRA_SOCIETY',
        data: '2026-09-08',
        horaInicio: '19:00',
        horaFim: '21:00',
      })
      assert.equal(c, null)
    })

    it('libera o horário quando a reserva é rejeitada ou cancelada', async () => {
      for (const status of ['REJEITADO', 'CANCELADO']) {
        await db.reserva.deleteMany()
        await db.reserva.create({ data: reserva({ status }) })

        const c = await buscarConflito(db, {
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
        await db.reserva.deleteMany()
        await db.reserva.create({ data: reserva({ status }) })

        const c = await buscarConflito(db, {
          espaco: 'QUADRA_SOCIETY',
          data: DATA,
          horaInicio: '19:00',
          horaFim: '21:00',
        })
        assert.notEqual(c, null, `status ${status} deveria ocupar o espaço`)
      }
    })

    it('ignora a própria reserva ao reavaliar', async () => {
      await db.reserva.deleteMany()
      const r = await db.reserva.create({ data: reserva() })

      const c = await buscarConflito(db, {
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
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva({ espaco: 'CAMPO_FUTEBOL' }) })

      const existente = await buscarReservaNoMesmoDia(db, {
        email: 'fulano@exemplo.com',
        data: DATA,
      })
      assert.notEqual(existente, null)
    })

    it('permite o mesmo e-mail em datas diferentes', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva() })

      const existente = await buscarReservaNoMesmoDia(db, {
        email: 'fulano@exemplo.com',
        data: '2026-09-08',
      })
      assert.equal(existente, null)
    })

    it('não conta reservas canceladas contra o limite', async () => {
      await db.reserva.deleteMany()
      await db.reserva.create({ data: reserva({ status: 'CANCELADO' }) })

      const existente = await buscarReservaNoMesmoDia(db, {
        email: 'fulano@exemplo.com',
        data: DATA,
      })
      assert.equal(existente, null)
    })
  })
} else {
  console.warn(
    '\n  [conflito.test.ts] TEST_DATABASE_URL não definida — pulando os testes de ' +
      'conflito de horário para não rodar contra o banco de produção (DATABASE_URL). ' +
      'Configure uma branch de teste separada no Neon e defina TEST_DATABASE_URL no ' +
      '.env para exercitar esta suíte.\n',
  )
}
