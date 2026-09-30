import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { STATUS_NA_AGENDA } from '../src/lib/dominio'
import { agendaConfigurada } from '../src/lib/agenda-google/cliente'
import { sincronizarAgendaFixa, sincronizarReserva } from '../src/lib/agenda-google/sincronizar'

/**
 * Reconciliação completa banco → Google Agenda.
 *
 *   npm run agenda:sincronizar
 *
 * Para quê:
 * - Publicar, na primeira vez, o que já estava aprovado antes da integração.
 * - Consertar o que ficou para trás quando o Google falhou no `after()` de
 *   uma mudança de status (o erro fica no log da Vercel).
 *
 * É idempotente — rodar de novo não duplica nada, só reafirma o estado. Roda
 * com --conditions=react-server (ver package.json) porque os módulos da
 * agenda importam `server-only`, que fora dessa condição se recusa a carregar.
 */
async function main() {
  if (!agendaConfigurada()) {
    console.error(
      'Google Agenda não configurado: defina GOOGLE_SERVICE_ACCOUNT_KEY e ' +
        'GOOGLE_CALENDAR_ID no .env (ver .env.example).',
    )
    process.exit(1)
  }

  // Quem deve estar na agenda, e quem já esteve (para remover se saiu).
  const reservas = await prisma.reserva.findMany({
    where: { OR: [{ status: { in: STATUS_NA_AGENDA } }, { googleEventId: { not: null } }] },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  const agendas = await prisma.agendaFixa.findMany({
    where: { OR: [{ ativa: true }, { googleEventId: { not: null } }] },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  let falhas = 0
  for (const { id } of reservas) if (!(await sincronizarReserva(id))) falhas++
  for (const { id } of agendas) if (!(await sincronizarAgendaFixa(id))) falhas++

  console.log(
    `Reservas: ${reservas.length} · Agendas fixas: ${agendas.length} · ` +
      (falhas ? `${falhas} falha(s) — ver erros acima.` : 'tudo sincronizado.'),
  )

  await prisma.$disconnect()
  process.exit(falhas ? 1 : 0)
}

main()
