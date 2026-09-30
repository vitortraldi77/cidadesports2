import {
  ESPACOS,
  STATUS,
  TIPOS_VINCULO,
  protocolo,
  type Espaco,
  type Status,
  type TipoVinculo,
} from '../dominio'
import { FUSO, diaDaSemana, somaDias } from '../datas'

/**
 * Tradução de Reserva e AgendaFixa para o formato de evento do Google Agenda.
 *
 * Funções puras — sem rede, sem banco — para que o que vai parar na agenda
 * da igreja possa ser testado sem credencial nenhuma. Quem fala com o Google
 * é cliente.ts; quem decide quando falar é sincronizar.ts.
 */

export type EventoGoogle = {
  summary: string
  description: string
  location: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  recurrence?: string[]
  /** Explícito para "ressuscitar" um evento que alguém apagou à mão na agenda. */
  status: 'confirmed'
  /** Marca o evento como nosso — invisível na agenda, legível pela API. */
  extendedProperties: { private: Record<string, string> }
}

// ---------- ids ----------

/**
 * O Google aceita que o cliente escolha o id do evento, desde que use só o
 * alfabeto base32hex (0-9 e a-v). Um id derivado do nosso torna a criação
 * idempotente: se a chamada cair depois de o Google gravar e antes de nós
 * guardarmos a resposta, a nova tentativa atualiza o mesmo evento em vez de
 * duplicá-lo.
 *
 * Os prefixos foram escolhidos letra a letra dentro de a-v — "agendafixa"
 * não serviria, o "x" está fora do alfabeto.
 */
export function idEventoReserva(reservaId: number): string {
  return `csreserva${reservaId}`
}

export function idEventoAgendaFixa(agendaId: number): string {
  return `csrecorrente${agendaId}`
}

export function idEventoValido(id: string): boolean {
  return /^[0-9a-v]{5,1024}$/.test(id)
}

// ---------- reserva ----------

type ReservaParaEvento = {
  id: number
  status: string
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  nomeSolicitante: string
  // Nulos nas reservas importadas do Google Agenda (ver schema.prisma).
  telefone: string | null
  email: string | null
  tipoVinculo: string | null
  finalidade: string | null
}

const RODAPE =
  'Gerenciado pelo sistema de reservas do Cidade Sports — alterações feitas ' +
  'aqui na agenda são sobrescritas na próxima mudança de status.'

export function eventoDaReserva(r: ReservaParaEvento): EventoGoogle {
  const espaco = ESPACOS[r.espaco as Espaco] ?? r.espaco
  const status = STATUS[r.status as Status] ?? r.status
  const vinculo = r.tipoVinculo
    ? (TIPOS_VINCULO[r.tipoVinculo as TipoVinculo] ?? r.tipoVinculo)
    : null

  // Maiúsculas no início seguem o padrão que já existia na agenda à mão
  // ("RESERVA CAMPO"). O "a confirmar" vai no FIM porque a visão de mês
  // corta o título: o espaço e o nome são o que precisa sobreviver ao corte.
  const aConfirmar = r.status === 'APROVADO' ? ' (a confirmar)' : ''

  // `null` marca a linha a omitir — uma reserva importada sem e-mail não
  // deve mostrar "E-mail: null" na agenda da igreja.
  const linhas: (string | null)[] = [
    `Protocolo: ${protocolo(r.id)}`,
    `Status: ${status}`,
    `Espaço: ${espaco}`,
    '',
    `Responsável: ${r.nomeSolicitante}`,
    r.telefone ? `Telefone: ${formatarTelefone(r.telefone)}` : null,
    r.email ? `E-mail: ${r.email}` : null,
    vinculo ? `Vínculo: ${vinculo}` : null,
    ...(r.finalidade ? ['', `Finalidade: ${r.finalidade}`] : []),
    '',
    RODAPE,
  ]

  return {
    summary: `RESERVA ${espacoCurtoMaiusculo(r.espaco)} – ${r.nomeSolicitante}${aConfirmar}`,
    description: linhas.filter((l) => l !== null).join('\n'),
    location: espaco,
    start: { dateTime: `${r.data}T${r.horaInicio}:00`, timeZone: FUSO },
    end: { dateTime: `${r.data}T${r.horaFim}:00`, timeZone: FUSO },
    status: 'confirmed',
    extendedProperties: {
      private: { origem: 'cidadesports', tipo: 'reserva', reservaId: String(r.id) },
    },
  }
}

// ---------- agenda fixa ----------

type AgendaFixaParaEvento = {
  id: number
  titulo: string
  responsavel: string
  espaco: string
  diaSemana: number
  horaInicio: string
  horaFim: string
  dataInicio: string
  dataFim: string | null
  ativa: boolean
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * Primeira data em ou depois de `iso` que cai no dia da semana pedido.
 *
 * O evento recorrente do Google começa na data de `start`, e essa data
 * precisa ser ela mesma uma ocorrência: um DTSTART numa quarta com
 * BYDAY=TU mostraria uma ocorrência fantasma na quarta.
 */
export function primeiraOcorrencia(iso: string, diaSemana: number): string {
  return somaDias(iso, (diaSemana - diaDaSemana(iso) + 7) % 7)
}

/**
 * Evento recorrente semanal, ou `null` quando não sobra nenhuma ocorrência
 * para mostrar — o chamador então apaga o evento.
 *
 * Desativar uma agenda fixa não apaga o passado da agenda do Google: encerra
 * a série em `hoje - 1`, que é o mesmo efeito que a desativação tem no
 * sistema (a partir de hoje, o horário deixa de estar bloqueado). Só quando
 * a série ainda nem tinha começado é que não sobra nada e o evento some.
 */
export function eventoDaAgendaFixa(a: AgendaFixaParaEvento, hoje: string): EventoGoogle | null {
  const inicio = primeiraOcorrencia(a.dataInicio, a.diaSemana)

  let fim = a.dataFim
  if (!a.ativa) {
    const ontem = somaDias(hoje, -1)
    fim = fim && fim < ontem ? fim : ontem
  }
  if (fim && fim < inicio) return null

  const regra = [`RRULE:FREQ=WEEKLY`, `BYDAY=${BYDAY[a.diaSemana]}`]
  if (fim) regra.push(`UNTIL=${untilEmUTC(fim)}`)

  const espaco = ESPACOS[a.espaco as Espaco] ?? a.espaco

  return {
    summary: `${a.titulo} – ${espacoCurtoMaiusculo(a.espaco)}`,
    description: [
      `Agenda fixa do Cidade Sports`,
      `Responsável: ${a.responsavel}`,
      `Espaço: ${espaco}`,
      '',
      RODAPE,
    ].join('\n'),
    location: espaco,
    start: { dateTime: `${inicio}T${a.horaInicio}:00`, timeZone: FUSO },
    end: { dateTime: `${inicio}T${a.horaFim}:00`, timeZone: FUSO },
    recurrence: [regra.join(';')],
    status: 'confirmed',
    extendedProperties: {
      private: { origem: 'cidadesports', tipo: 'agendaFixa', agendaFixaId: String(a.id) },
    },
  }
}

/**
 * UNTIL de um evento com horário precisa estar em UTC ("…T…Z"). O último
 * instante do dia `iso` em São Paulo é 23:59:59-03:00, ou seja, 02:59:59Z do
 * dia seguinte. O deslocamento fixo de 3h vale porque o Brasil não tem mais
 * horário de verão (extinto em 2019); se ele voltar, este é o ponto a mudar.
 */
function untilEmUTC(iso: string): string {
  return `${somaDias(iso, 1).replace(/-/g, '')}T025959Z`
}

/**
 * Encerra em `ultimoDia` uma regra de recorrência que o sistema NÃO criou —
 * uma série feita à mão na agenda e importada como agenda fixa.
 *
 * Diferente de eventoDaAgendaFixa, não redesenha a regra: ela pode cobrir
 * vários dias da semana (BYDAY=MO,TU,WE,TH,FR), ter intervalo, exceções. Só
 * troca o fim — remove UNTIL/COUNT que houver e põe o novo. As demais linhas
 * (EXDATE, RDATE) passam intactas.
 *
 * `diaInteiro`: eventos de dia inteiro usam UNTIL só com data, sem hora.
 */
export function encerrarRegra(recorrencia: string[], ultimoDia: string, diaInteiro = false): string[] {
  const ate = diaInteiro ? ultimoDia.replace(/-/g, '') : untilEmUTC(ultimoDia)
  return recorrencia.map((linha) => {
    if (!linha.startsWith('RRULE:')) return linha
    const partes = linha
      .slice('RRULE:'.length)
      .split(';')
      .filter((p) => !/^(UNTIL|COUNT)=/.test(p))
    return `RRULE:${[...partes, `UNTIL=${ate}`].join(';')}`
  })
}

// ---------- formatação ----------

function espacoCurtoMaiusculo(espaco: string): string {
  const curtos: Record<Espaco, string> = {
    QUADRA_SOCIETY: 'SOCIETY',
    QUADRA_COBERTA: 'QUADRA COBERTA',
    VOLEI_AREIA: 'QUADRA DE AREIA',
    CAMPO_FUTEBOL: 'CAMPO',
    ESPACO_IGNICAO: 'ESPAÇO IGNIÇÃO',
  }
  return curtos[espaco as Espaco] ?? espaco
}

/** "11987654321" -> "(11) 98765-4321"; o que não tiver 10 ou 11 dígitos passa intacto. */
export function formatarTelefone(digitos: string): string {
  const d = digitos.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digitos
}
