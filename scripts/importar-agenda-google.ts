import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { ESPACOS } from '../src/lib/dominio'
import { dataValida, horaValida } from '../src/lib/datas'

/**
 * Importação única dos lançamentos feitos à mão no Google Agenda antes de o
 * sistema existir.
 *
 *   npm run agenda:importar -- <plano.json>            # só valida
 *   npm run agenda:importar -- <plano.json> --gravar   # grava
 *
 * O plano é montado fora daqui, título a título, e revisado por uma pessoa:
 * os títulos da agenda antiga não têm padrão ("RESERVA QUADRA DE AREIA -
 * (14) 99834-3205 Ester Alves", "Reserva QUADRA- Milano (12 98876-6281)"),
 * e adivinhar espaço e nome por regex erraria em silêncio. O arquivo tem
 * nomes e telefones — por isso vem de fora do repositório.
 *
 * Idempotente: um registro cujo (agenda, evento, espaço[, dia]) já existe é
 * pulado, então rodar de novo não duplica nada.
 */

type AgendaFixaPlano = {
  titulo: string
  responsavel: string
  espaco: string
  diaSemana: number
  horaInicio: string
  horaFim: string
  dataInicio: string
  dataFim: string | null
  googleCalendarId: string
  googleEventId: string
  tituloOriginal: string
}

type ReservaPlano = {
  nomeSolicitante: string
  telefone: string | null
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  finalidade: string | null
  googleCalendarId: string
  googleEventId: string
  tituloOriginal: string
}

type Plano = { agendasFixas: AgendaFixaPlano[]; reservas: ReservaPlano[] }

function validar(plano: Plano): string[] {
  const erros: string[] = []
  const horario = (onde: string, x: { espaco: string; horaInicio: string; horaFim: string }) => {
    if (!(x.espaco in ESPACOS)) erros.push(`${onde}: espaço desconhecido "${x.espaco}"`)
    if (!horaValida(x.horaInicio) || !horaValida(x.horaFim)) erros.push(`${onde}: hora inválida`)
    else if (x.horaInicio >= x.horaFim) erros.push(`${onde}: término não é depois do início`)
  }

  plano.agendasFixas.forEach((a, i) => {
    const onde = `agenda fixa #${i} "${a.tituloOriginal}"`
    horario(onde, a)
    if (!Number.isInteger(a.diaSemana) || a.diaSemana < 0 || a.diaSemana > 6) erros.push(`${onde}: dia da semana inválido`)
    if (!dataValida(a.dataInicio)) erros.push(`${onde}: dataInicio inválida`)
    if (a.dataFim && !dataValida(a.dataFim)) erros.push(`${onde}: dataFim inválida`)
    if (!a.titulo.trim() || !a.responsavel.trim()) erros.push(`${onde}: título ou responsável vazio`)
    if (!a.googleCalendarId || !a.googleEventId) erros.push(`${onde}: sem vínculo com o Google`)
  })

  plano.reservas.forEach((r, i) => {
    const onde = `reserva #${i} "${r.tituloOriginal}"`
    horario(onde, r)
    if (!dataValida(r.data)) erros.push(`${onde}: data inválida`)
    if (!r.nomeSolicitante.trim()) erros.push(`${onde}: sem nome`)
    if (r.telefone !== null && !/^\d{10,13}$/.test(r.telefone)) erros.push(`${onde}: telefone "${r.telefone}"`)
    if (!r.googleCalendarId || !r.googleEventId) erros.push(`${onde}: sem vínculo com o Google`)
  })

  return erros
}

async function gravar(plano: Plano) {
  let criadas = 0
  let puladas = 0

  // Tudo ou nada: uma falha no meio não deixa metade da agenda importada.
  await prisma.$transaction(
    async (tx) => {
      for (const a of plano.agendasFixas) {
        const existe = await tx.agendaFixa.findFirst({
          where: {
            googleCalendarId: a.googleCalendarId,
            googleEventId: a.googleEventId,
            espaco: a.espaco,
            diaSemana: a.diaSemana,
          },
          select: { id: true },
        })
        if (existe) {
          puladas++
          continue
        }
        await tx.agendaFixa.create({
          data: {
            titulo: a.titulo,
            responsavel: a.responsavel,
            espaco: a.espaco,
            diaSemana: a.diaSemana,
            horaInicio: a.horaInicio,
            horaFim: a.horaFim,
            dataInicio: a.dataInicio,
            dataFim: a.dataFim,
            origem: 'GOOGLE_AGENDA',
            googleCalendarId: a.googleCalendarId,
            googleEventId: a.googleEventId,
          },
        })
        criadas++
      }

      for (const r of plano.reservas) {
        const existe = await tx.reserva.findFirst({
          where: {
            googleCalendarId: r.googleCalendarId,
            googleEventId: r.googleEventId,
            espaco: r.espaco,
          },
          select: { id: true },
        })
        if (existe) {
          puladas++
          continue
        }
        await tx.reserva.create({
          data: {
            nomeSolicitante: r.nomeSolicitante,
            telefone: r.telefone,
            espaco: r.espaco,
            data: r.data,
            horaInicio: r.horaInicio,
            horaFim: r.horaFim,
            finalidade: r.finalidade,
            // Estava na agenda da igreja: já era compromisso firmado.
            status: 'CONFIRMADO',
            origem: 'GOOGLE_AGENDA',
            observacaoAdmin: `Importada do Google Agenda. Título original: "${r.tituloOriginal.trim()}"`,
            googleCalendarId: r.googleCalendarId,
            googleEventId: r.googleEventId,
            logs: {
              create: { de: null, para: 'CONFIRMADO', observacao: 'Importada do Google Agenda.' },
            },
          },
        })
        criadas++
      }
    },
    // ~80 inserções num banco remoto passam longe dos 5 s padrão.
    { timeout: 120_000, maxWait: 10_000 },
  )

  return { criadas, puladas }
}

async function main() {
  const [arquivo, ...flags] = process.argv.slice(2)
  if (!arquivo) {
    console.error('Uso: npm run agenda:importar -- <plano.json> [--gravar]')
    process.exit(1)
  }

  const plano = JSON.parse(readFileSync(arquivo, 'utf8')) as Plano
  const erros = validar(plano)
  console.log(`Plano: ${plano.agendasFixas.length} agenda(s) fixa(s), ${plano.reservas.length} reserva(s).`)

  if (erros.length) {
    console.error(`\n${erros.length} erro(s) — nada foi gravado:\n` + erros.map((e) => `  - ${e}`).join('\n'))
    process.exit(1)
  }
  console.log('Validação: ok.')

  if (!flags.includes('--gravar')) {
    console.log('Modo de conferência. Para gravar, repita com --gravar.')
    return
  }

  const { criadas, puladas } = await gravar(plano)
  console.log(`Gravado: ${criadas} registro(s) criado(s), ${puladas} já existia(m).`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
