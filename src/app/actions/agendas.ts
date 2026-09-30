'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { exigirSessao } from '@/lib/auth'
import { agendaFixaSchema } from '@/lib/schemas'
import { STATUS_QUE_OCUPAM, protocolo } from '@/lib/dominio'
import { diaDaSemana, formatarData, somaDias } from '@/lib/datas'
import { sincronizarAgendaFixa } from '@/lib/agenda-google/sincronizar'

export type EstadoAgendaFixa = {
  erros?: Record<string, string[]>
  /** Erro geral — inclusive o de conflito, que aqui é bloqueio e não aviso. */
  mensagem?: string
  sucesso?: string
  valores?: Record<string, string>
  /** Mesmo papel do `chave` em criar-reserva.ts: força o remount dos campos. */
  chave?: number
}

/**
 * Sem data de término, a checagem de conflito não pode varrer "para sempre".
 * Meio ano à frente já é o bastante para o Vitor perceber um choque com
 * reservas que já existem — o resto do tempo a agenda fixa vale sem checagem
 * retroativa, porque pedidos futuros são barrados por ela dali em diante (ver
 * buscarConflitoAgendaFixa).
 */
const HORIZONTE_SEM_TERMINO_DIAS = 180

/**
 * Cria uma agenda fixa — um compromisso recorrente do próprio Cidade Sports,
 * fora do fluxo de aprovação do formulário público.
 *
 * Ao contrário do conflito no formulário público (aviso, com opção de manter
 * mesmo assim), aqui o conflito BLOQUEIA: quem cria já é a autoridade final,
 * então "criar mesmo com conflito" só faria sentido depois de decidir o que
 * fazer com a reserva que está no caminho — e essa decisão é rejeitar ou
 * cancelar a reserva primeiro, não empurrar o choque para a frente.
 */
export async function criarAgendaFixa(
  anterior: EstadoAgendaFixa,
  formData: FormData,
): Promise<EstadoAgendaFixa> {
  try {
    await exigirSessao()
  } catch {
    redirect('/admin/login')
  }

  const bruto = Object.fromEntries(formData) as Record<string, string>
  const chave = (anterior.chave ?? 0) + 1
  const valores = bruto

  const parsed = agendaFixaSchema.safeParse(bruto)
  if (!parsed.success) {
    const erros: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const campo = String(issue.path[0] ?? '_')
      ;(erros[campo] ??= []).push(issue.message)
    }
    return { erros, valores, chave }
  }

  const d = parsed.data
  const dataFim = d.dataFim || null
  const horizonte = dataFim ?? somaDias(d.dataInicio, HORIZONTE_SEM_TERMINO_DIAS)

  // --- Conflito com reservas que já ocupam a agenda ---
  const candidatas = await prisma.reserva.findMany({
    where: {
      espaco: d.espaco,
      status: { in: STATUS_QUE_OCUPAM },
      data: { gte: d.dataInicio, lte: horizonte },
      horaInicio: { lt: d.horaFim },
      horaFim: { gt: d.horaInicio },
    },
    select: { id: true, data: true },
    orderBy: { data: 'asc' },
  })
  const reservasConflitantes = candidatas.filter((r) => diaDaSemana(r.data) === d.diaSemana)

  if (reservasConflitantes.length > 0) {
    const exemplos = reservasConflitantes
      .slice(0, 3)
      .map((r) => `${protocolo(r.id)} (${formatarData(r.data)})`)
      .join(', ')
    const resto = reservasConflitantes.length > 3 ? ` e mais ${reservasConflitantes.length - 3}` : ''
    return {
      mensagem:
        `Esta agenda esbarraria em ${reservasConflitantes.length} reserva(s) já existente(s): ` +
        `${exemplos}${resto}. Rejeite ou cancele essas reservas antes de criar a agenda fixa, ` +
        `ou escolha outro dia da semana ou horário.`,
      valores,
      chave,
    }
  }

  // --- Conflito com outra agenda fixa já ativa ---
  const agendasExistentes = await prisma.agendaFixa.findMany({
    where: {
      ativa: true,
      espaco: d.espaco,
      diaSemana: d.diaSemana,
      horaInicio: { lt: d.horaFim },
      horaFim: { gt: d.horaInicio },
    },
    select: { titulo: true, dataInicio: true, dataFim: true },
  })
  const agendaConflitante = agendasExistentes.find((a) => {
    const fimA = a.dataFim ?? '9999-12-31'
    const fimNova = dataFim ?? '9999-12-31'
    return a.dataInicio <= fimNova && d.dataInicio <= fimA
  })

  if (agendaConflitante) {
    return {
      mensagem:
        `Já existe a agenda fixa "${agendaConflitante.titulo}" para o mesmo espaço, dia da ` +
        `semana e horário, com vigência sobreposta. Desative-a antes de criar esta, ou ajuste ` +
        `o horário ou o período de vigência.`,
      valores,
      chave,
    }
  }

  const criada = await prisma.agendaFixa.create({
    data: {
      titulo: d.titulo,
      responsavel: d.responsavel,
      espaco: d.espaco,
      diaSemana: d.diaSemana,
      horaInicio: d.horaInicio,
      horaFim: d.horaFim,
      dataInicio: d.dataInicio,
      dataFim,
    },
    select: { id: true },
  })

  after(() => sincronizarAgendaFixa(criada.id))

  revalidatePath('/admin/agendas')
  revalidatePath('/admin/calendario')
  revalidatePath('/admin')

  return { sucesso: 'Agenda fixa criada.', chave }
}

/** Desativa em vez de apagar — ver comentário no schema sobre o motivo. */
export async function desativarAgendaFixa(formData: FormData): Promise<void> {
  try {
    await exigirSessao()
  } catch {
    redirect('/admin/login')
  }

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return

  await prisma.agendaFixa.update({ where: { id }, data: { ativa: false } })
  // Encerra a série no Google a partir de hoje, sem apagar o passado.
  after(() => sincronizarAgendaFixa(id))

  revalidatePath('/admin/agendas')
  revalidatePath('/admin/calendario')
  revalidatePath('/admin')
}
