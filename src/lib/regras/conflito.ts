import type { Prisma } from '@/generated/prisma/client'
import { DIAS_SEMANA, ESPACOS, STATUS_QUE_OCUPAM, type DiaSemana, type Espaco } from '../dominio'
import { diaDaSemana, formatarData, formatarIntervalo } from '../datas'

/** Aceita tanto o client normal quanto o client de dentro de uma transação. */
type ClientPrisma = Prisma.TransactionClient

type Periodo = {
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  /** Ao reavaliar uma reserva existente, ela não deve conflitar consigo mesma. */
  ignorarId?: number
}

/**
 * Busca uma reserva que ocupe o mesmo espaço, na mesma data, com horário
 * sobreposto.
 *
 * A sobreposição de dois intervalos [aIni, aFim) e [bIni, bFim) acontece quando
 * `aIni < bFim && bIni < aFim`. Note que a comparação é estrita: reservas
 * encostadas (10:00–12:00 e 12:00–14:00) NÃO conflitam, que é o comportamento
 * desejado — o espaço vaga exatamente no horário de término.
 *
 * Como as horas são strings "HH:mm", a comparação lexicográfica do banco já é a
 * comparação cronológica, então o filtro roda no SQL e usa o índice
 * (espaco, data, status) em vez de carregar o dia inteiro para a memória.
 *
 * Só bloqueiam as reservas com status em STATUS_QUE_OCUPAM. É por isso que
 * rejeitar ou cancelar libera a vaga sem nenhuma rotina extra.
 */
export async function buscarConflito(db: ClientPrisma, p: Periodo) {
  return db.reserva.findFirst({
    where: {
      espaco: p.espaco,
      data: p.data,
      status: { in: STATUS_QUE_OCUPAM },
      horaInicio: { lt: p.horaFim },
      horaFim: { gt: p.horaInicio },
      ...(p.ignorarId ? { id: { not: p.ignorarId } } : {}),
    },
    select: { id: true, horaInicio: true, horaFim: true, status: true },
    orderBy: { horaInicio: 'asc' },
  })
}

/*
 * Nota de redação: as mensagens abaixo evitam de propósito o artigo antes do
 * nome do espaço. "Quadra" é feminino e "campo" é masculino, então qualquer
 * frase do tipo "o {espaco} já está reservado" sai errada em dois dos três
 * casos. Construir a frase sem artigo resolve sem precisar carregar gênero e
 * concordância verbal para cada espaço.
 */

export function mensagemDeConflito(
  espaco: string,
  data: string,
  conflito: { horaInicio: string; horaFim: string },
): string {
  const nome = ESPACOS[espaco as Espaco] ?? espaco
  return (
    `Já existe uma reserva para ${nome} em ${formatarData(data)}, das ` +
    `${formatarIntervalo(conflito.horaInicio, conflito.horaFim)}, e esse período ` +
    `se sobrepõe ao que você pediu. Escolha outro horário, outra data ou outro espaço.`
  )
}

/**
 * Aviso exibido ANTES do envio, quando o horário escolhido esbarra em outro
 * pedido. Ao contrário de `mensagemDeConflito` (bloqueio), este é só um
 * alerta — o solicitante decide se mantém o pedido, e a administração escolhe
 * depois quem atender.
 *
 * `grave` diferencia os dois cenários possíveis: a outra reserva ainda está
 * PENDENTE (também sem decisão, então a disputa é justa) ou já foi
 * APROVADO/CONFIRMADO (já tem prioridade, e o novo pedido dificilmente vinga).
 */
export function avisoDeConflito(
  espaco: string,
  data: string,
  conflito: { horaInicio: string; horaFim: string; status: string },
): { mensagem: string; grave: boolean } {
  const nome = ESPACOS[espaco as Espaco] ?? espaco
  const intervalo = formatarIntervalo(conflito.horaInicio, conflito.horaFim)
  const grave = conflito.status !== 'PENDENTE'

  if (grave) {
    const situacao = conflito.status === 'CONFIRMADO' ? 'confirmada' : 'aprovada'
    return {
      grave,
      mensagem:
        `${nome} já tem uma reserva ${situacao} para outro responsável em ${formatarData(data)}, ` +
        `das ${intervalo}, sobrepondo o horário pedido. É pouco provável que este pedido seja ` +
        `atendido, mas você pode enviá-lo mesmo assim — ele ficará pendente de avaliação.`,
    }
  }

  return {
    grave,
    mensagem:
      `Já existe uma solicitação pendente de avaliação para ${nome} em ${formatarData(data)}, ` +
      `das ${intervalo}, no mesmo período. Como ainda não foi decidida, você pode manter seu ` +
      `pedido — cabe à administração escolher qual será atendido.`,
  }
}

type ReservaMinima = {
  id: number
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  status: string
}

/**
 * Mapeia, para cada reserva de `alvos`, a outra reserva de `candidatas` com
 * quem ela se sobrepõe (mesmo espaço, mesma data, horário cruzado) — se
 * houver.
 *
 * Usado pelo painel para sinalizar, na lista, pedidos que concorrem pelo
 * mesmo horário. Como o formulário público não bloqueia mais esse caso (ver
 * `verificarConflito` em app/actions/criar-reserva.ts), duas solicitações
 * PENDENTE para o mesmo horário podem coexistir até alguém decidir — e é
 * exatamente isso que a administração precisa enxergar antes de aprovar uma
 * delas sem perceber que a outra também está de pé.
 *
 * `candidatas` normalmente é um superconjunto de `alvos`: inclui reservas que
 * ocupam o mesmo espaço+data mas ficaram fora do filtro da tela (por status,
 * por exemplo) — sem isso, um pedido PENDENTE não veria o conflito com uma
 * reserva já CONFIRMADO que o filtro atual esconde.
 */
export function mapearConflitos(
  alvos: ReservaMinima[],
  candidatas: ReservaMinima[],
): Map<number, ReservaMinima> {
  const mapa = new Map<number, ReservaMinima>()

  for (const r of alvos) {
    const outra = candidatas.find(
      (c) =>
        c.id !== r.id &&
        c.espaco === r.espaco &&
        c.data === r.data &&
        c.horaInicio < r.horaFim &&
        r.horaInicio < c.horaFim,
    )
    if (outra) mapa.set(r.id, outra)
  }

  return mapa
}

export type AgendaFixaMinima = {
  id: number
  titulo: string
  responsavel: string
  espaco: string
  diaSemana: number
  horaInicio: string
  horaFim: string
  dataInicio: string
  dataFim: string | null
}

/** Se a regra `a` está em vigor e cai no dia da semana de `data`. */
function agendaFixaOcupaData(a: AgendaFixaMinima, data: string): boolean {
  return (
    diaDaSemana(data) === a.diaSemana &&
    data >= a.dataInicio &&
    (a.dataFim === null || data <= a.dataFim)
  )
}

/**
 * Acha, entre as agendas fixas ativas de um espaço, a que ocupa `p.data` num
 * horário sobreposto ao pedido — se houver.
 *
 * Complementa `buscarConflito`: uma agenda fixa não é uma `Reserva` no banco,
 * então não aparece naquela busca, mas ocupa a agenda com a mesma força — na
 * prática mais, porque é uma decisão do próprio Vitor, não um pedido em
 * avaliação.
 */
export function buscarConflitoAgendaFixa(
  agendas: AgendaFixaMinima[],
  p: { espaco: string; data: string; horaInicio: string; horaFim: string },
): AgendaFixaMinima | undefined {
  return agendas.find(
    (a) =>
      a.espaco === p.espaco &&
      agendaFixaOcupaData(a, p.data) &&
      a.horaInicio < p.horaFim &&
      p.horaInicio < a.horaFim,
  )
}

function diaSemanaLabel(dia: number): string {
  return DIAS_SEMANA[dia as DiaSemana] ?? String(dia)
}

/** Mensagem de bloqueio (rede de segurança do servidor — ver criarReserva). */
export function mensagemDeConflitoAgendaFixa(espaco: string, agenda: AgendaFixaMinima): string {
  const nome = ESPACOS[espaco as Espaco] ?? espaco
  return (
    `${nome} tem uma agenda fixa ("${agenda.titulo}", ${agenda.responsavel}) toda ` +
    `${diaSemanaLabel(agenda.diaSemana)}, das ${formatarIntervalo(agenda.horaInicio, agenda.horaFim)}, ` +
    `e esse período se sobrepõe ao que você pediu. Escolha outro horário, outra data ou outro espaço.`
  )
}

/** Aviso exibido antes do envio — mesma lógica de `avisoDeConflito`, para agenda fixa. */
export function avisoDeConflitoAgendaFixa(
  espaco: string,
  agenda: AgendaFixaMinima,
): { mensagem: string; grave: boolean } {
  const nome = ESPACOS[espaco as Espaco] ?? espaco
  return {
    grave: true,
    mensagem:
      `${nome} tem uma agenda fixa ("${agenda.titulo}", ${agenda.responsavel}) toda ` +
      `${diaSemanaLabel(agenda.diaSemana)}, das ${formatarIntervalo(agenda.horaInicio, agenda.horaFim)}, ` +
      `sobrepondo o horário pedido. É pouco provável que este pedido seja atendido, mas você pode ` +
      `enviá-lo mesmo assim — ele ficará pendente de avaliação.`,
  }
}

/**
 * Mesma ideia de `mapearConflitos`, mas contra agendas fixas em vez de outras
 * reservas — usado pela lista do painel para sinalizar um pedido que esbarra
 * numa agenda fixa sem precisar abrir o calendário para descobrir.
 */
export function mapearConflitosComAgendaFixa(
  alvos: ReservaMinima[],
  agendas: AgendaFixaMinima[],
): Map<number, AgendaFixaMinima> {
  const mapa = new Map<number, AgendaFixaMinima>()

  for (const r of alvos) {
    const achada = buscarConflitoAgendaFixa(agendas, r)
    if (achada) mapa.set(r.id, achada)
  }

  return mapa
}

/**
 * Limite de 1 reserva por responsável (e-mail) por dia, em qualquer espaço.
 */
export async function buscarReservaNoMesmoDia(
  db: ClientPrisma,
  p: { email: string; data: string; ignorarId?: number },
) {
  return db.reserva.findFirst({
    where: {
      email: p.email,
      data: p.data,
      status: { in: STATUS_QUE_OCUPAM },
      ...(p.ignorarId ? { id: { not: p.ignorarId } } : {}),
    },
    select: { id: true, espaco: true, horaInicio: true, horaFim: true },
  })
}

export function mensagemDeLimiteDiario(
  data: string,
  existente: { espaco: string; horaInicio: string; horaFim: string },
): string {
  const nome = ESPACOS[existente.espaco as Espaco] ?? existente.espaco
  return (
    `Este e-mail já possui uma reserva em ${formatarData(data)} ` +
    `(${nome}, ${formatarIntervalo(existente.horaInicio, existente.horaFim)}). ` +
    `É permitida apenas 1 reserva por responsável por dia. Escolha outra data ` +
    `ou aguarde o cancelamento da reserva existente.`
  )
}
