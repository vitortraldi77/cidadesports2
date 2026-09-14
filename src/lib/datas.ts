/**
 * Utilitários de data e hora.
 *
 * Tudo trafega como string em formato fixo: datas "YYYY-MM-DD", horas "HH:mm".
 * Nenhuma função aqui devolve Date — objetos Date carregam fuso horário e é
 * exatamente isso que causa o bug de a reserva "andar" um dia. A única
 * conversão para Date acontece dentro destas funções, sempre em UTC, e o
 * resultado volta como string.
 */

export const FUSO = 'America/Sao_Paulo'

/** Data de hoje no fuso de São Paulo, como "YYYY-MM-DD". */
export function hoje(): string {
  // en-CA formata como YYYY-MM-DD, que é justamente o formato que usamos.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** "YYYY-MM-DD" -> Date em UTC meia-noite (uso interno, nunca exportado). */
function paraUTC(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function paraISO(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}

/** Valida o formato e a existência real da data (rejeita 2026-02-30). */
export function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return paraISO(paraUTC(iso)) === iso
}

export function horaValida(hhmm: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(iso: string): number {
  return paraUTC(iso).getUTCDay()
}

/** Dia útil = segunda a sexta. Feriados não são considerados (ver README). */
export function ehDiaUtil(iso: string): boolean {
  const d = diaDaSemana(iso)
  return d >= 1 && d <= 5
}

export function somaDias(iso: string, dias: number): string {
  const dt = paraUTC(iso)
  dt.setUTCDate(dt.getUTCDate() + dias)
  return paraISO(dt)
}

/**
 * Avança N dias úteis a partir de `iso`, sem contar o próprio dia de partida.
 *
 * Exemplo com N=3: pedido enviado numa sexta-feira conta segunda (1),
 * terça (2) e quarta (3) — logo a primeira data aceitável é a quarta.
 */
export function somaDiasUteis(iso: string, dias: number): string {
  let atual = iso
  let contados = 0
  while (contados < dias) {
    atual = somaDias(atual, 1)
    if (ehDiaUtil(atual)) contados++
  }
  return atual
}

/** "HH:mm" -> minutos desde a meia-noite. */
export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function duracaoEmMinutos(inicio: string, fim: string): number {
  return paraMinutos(fim) - paraMinutos(inicio)
}

// ---------- formatação para exibição ----------

/** "2026-09-15" -> "15/09/2026" */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** "2026-09-15" -> "terça-feira, 15/09/2026" */
export function formatarDataPorExtenso(iso: string): string {
  return `${DIAS[diaDaSemana(iso)]}, ${formatarData(iso)}`
}

export function formatarIntervalo(inicio: string, fim: string): string {
  return `${inicio} às ${fim}`
}

/** Idade em anos completos, para exibição no painel. */
export function idade(nascimento: string, referencia = hoje()): number {
  const [an, mn, dn] = nascimento.split('-').map(Number)
  const [ar, mr, dr] = referencia.split('-').map(Number)
  let anos = ar - an
  if (mr < mn || (mr === mn && dr < dn)) anos--
  return anos
}

// ---------- semanas (usado pelo calendário) ----------

/**
 * Segunda-feira da semana a que `iso` pertence.
 *
 * A semana começa na segunda, não no domingo: a operação do Cidade Sports é
 * organizada por semana de expediente, e a antecedência é contada em dias
 * úteis.
 */
export function inicioDaSemana(iso: string): string {
  const dow = diaDaSemana(iso) // 0 = domingo
  const recuo = (dow + 6) % 7 // domingo recua 6, segunda 0, terça 1...
  return somaDias(iso, -recuo)
}

/** Os 7 dias da semana de `iso`, de segunda a domingo. */
export function diasDaSemana(iso: string): string[] {
  const segunda = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, i) => somaDias(segunda, i))
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-09-07" -> "seg" */
export function diaCurto(iso: string): string {
  return DIAS_CURTOS[diaDaSemana(iso)]
}

/** "2026-09-07" -> "07/09" */
export function diaEMes(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
