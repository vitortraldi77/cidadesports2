import 'server-only'
import { SignJWT, importPKCS8 } from 'jose'
import type { EventoGoogle } from './eventos'

/**
 * Cliente mínimo da Google Calendar API, autenticado por service account.
 *
 * Por que não o pacote `googleapis`: são ~100 MB para usar três chamadas
 * REST. A troca de credencial é um JWT assinado com RS256 — o `jose`, que o
 * projeto já usa para a sessão do admin, faz isso em poucas linhas.
 *
 * Configuração (ambas obrigatórias; sem elas a sincronização fica desligada
 * e o sistema funciona normalmente — é o caso do desenvolvimento local):
 *
 * - GOOGLE_SERVICE_ACCOUNT_KEY: o conteúdo INTEIRO do .json baixado no
 *   Google Cloud, colado como está.
 * - GOOGLE_CALENDAR_ID: o id da agenda (Configurações da agenda → "Integrar
 *   agenda" → "ID da agenda"). A agenda precisa estar compartilhada com o
 *   e-mail da service account, com "Fazer alterações nos eventos".
 */

const ESCOPO = 'https://www.googleapis.com/auth/calendar.events'
const URL_TOKEN = 'https://oauth2.googleapis.com/token'
const URL_API = 'https://www.googleapis.com/calendar/v3'

type Config = { email: string; chavePrivada: string; calendarId: string }

function lerConfig(): Config | null {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!bruto || !calendarId) return null

  let cred: { client_email?: string; private_key?: string }
  try {
    cred = JSON.parse(bruto)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido — cole o arquivo inteiro.')
  }
  if (!cred.client_email || !cred.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não tem client_email/private_key.')
  }
  return { email: cred.client_email, chavePrivada: cred.private_key, calendarId }
}

export function agendaConfigurada(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_ID)
}

/**
 * Agenda onde o sistema cria os eventos novos. Os importados continuam na
 * agenda de onde vieram — cada registro guarda a sua em `googleCalendarId`.
 */
export function agendaPadrao(): string {
  const id = process.env.GOOGLE_CALENDAR_ID
  if (!id) throw new Error('GOOGLE_CALENDAR_ID não definido.')
  return id
}

export class ErroGoogle extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem)
  }
}

// O token vale 1h. Guardado no módulo, é reaproveitado enquanto a função
// serverless continuar quente — várias mudanças de status seguidas no painel
// não pedem um token novo cada uma.
let tokenEmCache: { valor: string; expiraEm: number } | null = null

async function obterToken(config: Config): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  if (tokenEmCache && tokenEmCache.expiraEm - 60 > agora) return tokenEmCache.valor

  const chave = await importPKCS8(config.chavePrivada, 'RS256')
  const assertion = await new SignJWT({ scope: ESCOPO })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(config.email)
    .setAudience(URL_TOKEN)
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chave)

  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!resposta.ok) {
    throw new ErroGoogle(resposta.status, `Falha ao autenticar no Google: ${await resposta.text()}`)
  }

  const { access_token, expires_in } = (await resposta.json()) as {
    access_token: string
    expires_in: number
  }
  tokenEmCache = { valor: access_token, expiraEm: agora + expires_in }
  return access_token
}

async function chamar(
  metodo: string,
  calendarId: string,
  caminho: string,
  corpo?: unknown,
): Promise<Response> {
  const config = lerConfig()
  if (!config) throw new Error('Google Agenda não configurado.')

  const token = await obterToken(config)
  const url = `${URL_API}/calendars/${encodeURIComponent(calendarId)}${caminho}`
  return fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
}

async function falhar(resposta: Response, acao: string): Promise<never> {
  throw new ErroGoogle(resposta.status, `Google Agenda (${acao}): ${resposta.status} ${await resposta.text()}`)
}

/**
 * Cria ou atualiza o evento `id` — "upsert".
 *
 * Tenta PATCH primeiro, que é o caso comum depois da criação (APROVADO →
 * CONFIRMADO) e o único possível para eventos importados, cujo id veio do
 * Google. PATCH, e não PUT, preserva o que alguém ajustou à mão e não é
 * nosso: cor, lembretes, convidados. Sem o evento (404), cria com o id dado.
 */
export async function salvarEvento(
  calendarId: string,
  id: string,
  evento: EventoGoogle,
): Promise<void> {
  const caminho = `/events/${encodeURIComponent(id)}`

  const patch = await chamar('PATCH', calendarId, caminho, evento)
  if (patch.ok) return
  if (patch.status !== 404) await falhar(patch, `atualizar ${id}`)

  const insercao = await chamar('POST', calendarId, '/events', { id, ...evento })
  if (!insercao.ok) await falhar(insercao, `criar ${id}`)
}

/** Remove o evento. Já não existir (404) ou já ter sido apagado (410) é sucesso. */
export async function removerEvento(calendarId: string, id: string): Promise<void> {
  const resposta = await chamar('DELETE', calendarId, `/events/${encodeURIComponent(id)}`)
  if (resposta.ok || resposta.status === 404 || resposta.status === 410) return
  await falhar(resposta, `remover ${id}`)
}

export type EventoLido = {
  status: string
  recurrence?: string[]
  start: { date?: string; dateTime?: string }
}

/** Lê um evento; `null` se não existe mais. */
export async function lerEvento(calendarId: string, id: string): Promise<EventoLido | null> {
  const resposta = await chamar('GET', calendarId, `/events/${encodeURIComponent(id)}`)
  if (resposta.status === 404 || resposta.status === 410) return null
  if (!resposta.ok) await falhar(resposta, `ler ${id}`)
  return (await resposta.json()) as EventoLido
}

/** Troca só a regra de recorrência, sem tocar em título, cor ou convidados. */
export async function atualizarRecorrencia(
  calendarId: string,
  id: string,
  recurrence: string[],
): Promise<void> {
  const resposta = await chamar('PATCH', calendarId, `/events/${encodeURIComponent(id)}`, {
    recurrence,
  })
  if (!resposta.ok) await falhar(resposta, `encerrar série ${id}`)
}
