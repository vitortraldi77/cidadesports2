import 'server-only'
import { prisma } from '../db'
import { STATUS_NA_AGENDA, type Status } from '../dominio'
import { hoje, somaDias } from '../datas'
import {
  agendaConfigurada,
  agendaPadrao,
  atualizarRecorrencia,
  lerEvento,
  removerEvento,
  salvarEvento,
} from './cliente'
import {
  encerrarRegra,
  eventoDaAgendaFixa,
  eventoDaReserva,
  idEventoAgendaFixa,
  idEventoReserva,
} from './eventos'

/**
 * Espelha o estado do banco no Google Agenda, em um único sentido: o sistema
 * é a fonte da verdade e a agenda só reflete. Nada lido da agenda muda o banco.
 *
 * As funções releem o registro em vez de receber os dados de quem chamou:
 * rodam em `after()`, depois da resposta, e o que vale é o estado final no
 * banco — não o de um instante antes.
 *
 * Nunca lançam. Falhar em falar com o Google não pode desfazer nem travar a
 * mudança de status, que já foi gravada; o erro vai para o log da Vercel e o
 * `npm run agenda:sincronizar` reconcilia depois. Devolvem `false` na falha
 * para o script de reconciliação poder contar.
 *
 * Eventos IMPORTADOS (feitos à mão antes do sistema) têm duas diferenças:
 *
 * - Um evento pode ter virado vários registros ("Campeonato (Campo, Society
 *   e Quadra Coberta)" → três reservas). Esse evento nunca é reescrito — o
 *   título dele fala dos três —, e só sai da agenda quando nenhum dos
 *   registros ligados a ele continua ocupando o espaço.
 * - Uma série importada não é redesenhada pelo sistema: desativar encerra a
 *   série no Google (UNTIL = ontem) sem mexer em título, dias ou exceções.
 */

const naAgenda = (status: string) => STATUS_NA_AGENDA.includes(status as Status)

export async function sincronizarReserva(id: number): Promise<boolean> {
  if (!agendaConfigurada()) return true

  try {
    const r = await prisma.reserva.findUnique({ where: { id } })
    if (!r) return true

    const calendarId = r.googleCalendarId ?? agendaPadrao()

    if (r.googleEventId) {
      const irmas = await prisma.reserva.findMany({
        where: { googleCalendarId: calendarId, googleEventId: r.googleEventId, id: { not: id } },
        select: { status: true },
      })
      if (irmas.length > 0) {
        if (!naAgenda(r.status) && !irmas.some((i) => naAgenda(i.status))) {
          await removerEvento(calendarId, r.googleEventId)
        }
        return true
      }
    }

    if (naAgenda(r.status)) {
      const eventId = r.googleEventId ?? idEventoReserva(r.id)
      await salvarEvento(calendarId, eventId, eventoDaReserva(r))
      if (!r.googleEventId) {
        await prisma.reserva.update({
          where: { id },
          data: { googleCalendarId: calendarId, googleEventId: eventId },
        })
      }
    } else if (r.googleEventId) {
      // O id fica guardado mesmo depois de remover: é o rastro de que o
      // evento existiu, e remover de novo é inofensivo (410 = já removido).
      await removerEvento(calendarId, r.googleEventId)
    }
    return true
  } catch (e) {
    console.error(`[agenda-google] reserva ${id}:`, e)
    return false
  }
}

export async function sincronizarAgendaFixa(id: number): Promise<boolean> {
  if (!agendaConfigurada()) return true

  try {
    const a = await prisma.agendaFixa.findUnique({ where: { id } })
    if (!a) return true

    // Desativada e nunca publicada: não há o que encerrar, e publicar agora
    // só para mostrar um histórico que ninguém pediu seria ruído.
    if (!a.ativa && !a.googleEventId) return true

    const calendarId = a.googleCalendarId ?? agendaPadrao()

    if (a.origem === 'GOOGLE_AGENDA' && a.googleEventId) {
      await encerrarSerieImportada(a.id, calendarId, a.googleEventId, a.ativa)
      return true
    }

    const evento = eventoDaAgendaFixa(a, hoje())
    if (!evento) {
      if (a.googleEventId) await removerEvento(calendarId, a.googleEventId)
      return true
    }

    const eventId = a.googleEventId ?? idEventoAgendaFixa(a.id)
    await salvarEvento(calendarId, eventId, evento)
    if (!a.googleEventId) {
      await prisma.agendaFixa.update({
        where: { id },
        data: { googleCalendarId: calendarId, googleEventId: eventId },
      })
    }
    return true
  } catch (e) {
    console.error(`[agenda-google] agenda fixa ${id}:`, e)
    return false
  }
}

/**
 * Série importada: só age quando a última agenda fixa ligada a ela é
 * desativada. Enquanto o Colégio Inspire de segunda continuar ativo,
 * desativar o de sexta não pode encerrar a série inteira — ela é uma só no
 * Google.
 */
async function encerrarSerieImportada(
  id: number,
  calendarId: string,
  eventId: string,
  ativa: boolean,
): Promise<void> {
  if (ativa) return

  const aindaAtivas = await prisma.agendaFixa.count({
    where: { googleCalendarId: calendarId, googleEventId: eventId, ativa: true, id: { not: id } },
  })
  if (aindaAtivas > 0) return

  const evento = await lerEvento(calendarId, eventId)
  if (!evento || evento.status === 'cancelled' || !evento.recurrence) return

  const ontem = somaDias(hoje(), -1)
  const diaInteiro = Boolean(evento.start.date)
  const inicio = (evento.start.date ?? evento.start.dateTime ?? '').slice(0, 10)

  // Série que nem começou: encerrar "ontem" a deixaria vazia — remove.
  if (inicio > ontem) {
    await removerEvento(calendarId, eventId)
    return
  }
  await atualizarRecorrencia(calendarId, eventId, encerrarRegra(evento.recurrence, ontem, diaInteiro))
}
