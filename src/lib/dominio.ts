/**
 * Valores válidos do domínio e seus rótulos de exibição.
 *
 * Este arquivo é a fonte de verdade dos "enums" — o banco guarda texto puro
 * (limitação do SQLite) e é aqui que se define o que esse texto pode ser.
 */

export const ESPACOS = {
  QUADRA_SOCIETY: 'Quadra Society',
  QUADRA_COBERTA: 'Quadra Coberta',
  VOLEI_AREIA: 'Quadra de Vôlei de Areia',
  CAMPO_FUTEBOL: 'Campo de Futebol',
  // Sala multiuso das lutas e aulas: jiu jitsu, capoeira, pilates, boxe e
  // muay thai. O "tatame" que aparece em alguns eventos antigos da agenda
  // fica dentro dele — não é um espaço à parte.
  ESPACO_IGNICAO: 'Espaço Ignição',
} as const

export type Espaco = keyof typeof ESPACOS

export const TIPOS_VINCULO = {
  PASTOR_MINISTRO_OBREIRO: 'Pastor / Ministro / Obreiro',
  SUPERVISOR_COORD_LIDER_GRUPO: 'Supervisor / Coordenador / Líder de Grupo da Cidade',
  LIDER_MINISTERIO: 'Líder de Ministério',
  MEMBRO: 'Membro da Igreja da Cidade',
  NAO_MEMBRO: 'Não membro da Igreja da Cidade',
} as const

export type TipoVinculo = keyof typeof TIPOS_VINCULO

/** Único vínculo que exige código de membresia. */
export const VINCULO_EXIGE_MEMBRESIA: TipoVinculo = 'MEMBRO'

export const STATUS = {
  PENDENTE: 'Pendente de avaliação',
  APROVADO: 'Aprovado — aguardando contato',
  CONFIRMADO: 'Confirmado',
  REJEITADO: 'Rejeitado',
  CANCELADO: 'Cancelado',
} as const

export type Status = keyof typeof STATUS

/**
 * Status que OCUPAM o espaço, isto é, que bloqueiam novos pedidos no mesmo
 * horário. Rejeitar ou cancelar libera a vaga automaticamente por não estar
 * nesta lista — não existe nenhuma outra rotina de "liberação".
 */
export const STATUS_QUE_OCUPAM: Status[] = ['PENDENTE', 'APROVADO', 'CONFIRMADO']

/**
 * Status que aparecem no Google Agenda. Mais estreito que STATUS_QUE_OCUPAM de
 * propósito: um pedido PENDENTE bloqueia o horário no sistema, mas ainda não
 * foi aceito — mostrá-lo na agenda da igreja passaria a ideia de compromisso
 * firmado. Sair desta lista (rejeitar, cancelar) remove o evento.
 */
export const STATUS_NA_AGENDA: Status[] = ['APROVADO', 'CONFIRMADO']

/** Transições permitidas. Impede, por exemplo, confirmar um pedido rejeitado. */
export const TRANSICOES: Record<Status, Status[]> = {
  PENDENTE: ['APROVADO', 'REJEITADO'],
  APROVADO: ['CONFIRMADO', 'CANCELADO', 'REJEITADO'],
  CONFIRMADO: ['CANCELADO'],
  REJEITADO: [],
  CANCELADO: [],
}

export function podeTransicionar(de: Status, para: Status): boolean {
  return TRANSICOES[de]?.includes(para) ?? false
}

/** Regras numéricas do processo, num lugar só. */
export const REGRAS = {
  /** Antecedência mínima, em dias úteis (seg–sex). */
  ANTECEDENCIA_DIAS_UTEIS: 3,
  /** Duração máxima da reserva, em minutos. */
  DURACAO_MAXIMA_MINUTOS: 120,
  /** Reservas permitidas por responsável (e-mail) por dia, em qualquer espaço. */
  RESERVAS_POR_DIA_POR_RESPONSAVEL: 1,
} as const

/** Protocolo legível que o solicitante informa ao Vitor: CS-000123 */
export function protocolo(id: number): string {
  return `CS-${String(id).padStart(6, '0')}`
}

/** Nomes curtos, para caber nos blocos estreitos do calendário. */
export const ESPACOS_CURTOS: Record<Espaco, string> = {
  QUADRA_SOCIETY: 'Society',
  QUADRA_COBERTA: 'Coberta',
  VOLEI_AREIA: 'Vôlei',
  CAMPO_FUTEBOL: 'Campo',
  ESPACO_IGNICAO: 'Ignição',
}

/**
 * Dias da semana para as agendas fixas — mesma numeração de `Date.getDay()`
 * e de `diaDaSemana()` em lib/datas.ts (0 = domingo).
 */
export const DIAS_SEMANA = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
} as const

export type DiaSemana = keyof typeof DIAS_SEMANA
