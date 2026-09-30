'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { mudarStatus, type EstadoAcao } from '@/app/actions/admin'
import { Etiqueta } from '@/components/ui/Etiqueta'
import {
  ESPACOS,
  STATUS,
  TIPOS_VINCULO,
  protocolo,
  type Espaco,
  type Status,
  type TipoVinculo,
} from '@/lib/dominio'
import { formatarDataPorExtenso, formatarIntervalo, hoje, idade } from '@/lib/datas'
import { linkWhatsApp } from '@/lib/whatsapp'

// Os campos de contato são nulos nas reservas importadas do Google Agenda,
// que só trazem o que estava escrito no título do evento.
type Reserva = {
  id: number
  nomeSolicitante: string
  dataNascimento: string | null
  telefone: string | null
  email: string | null
  tipoVinculo: string | null
  codigoMembresia: string | null
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  finalidade: string | null
  status: string
  observacaoAdmin: string | null
  origem: string
  criadoEm: Date
}

/**
 * Rótulos de cada destino de status.
 *
 * As ações destrutivas têm um rótulo próprio para a etapa de confirmação —
 * derivar um do outro produziria frases como "Confirmar cancelar reserva".
 */
const ACOES: Record<
  string,
  { rotulo: string; destrutiva: boolean; pergunta?: string; confirmacao?: string }
> = {
  APROVADO: { rotulo: 'Aprovar', destrutiva: false },
  CONFIRMADO: { rotulo: 'Marcar como confirmado', destrutiva: false },
  REJEITADO: {
    rotulo: 'Rejeitar',
    destrutiva: true,
    pergunta: 'Rejeitar este pedido?',
    confirmacao: 'Confirmar rejeição',
  },
  CANCELADO: {
    rotulo: 'Cancelar reserva',
    destrutiva: true,
    pergunta: 'Cancelar esta reserva?',
    confirmacao: 'Confirmar cancelamento',
  },
}

/**
 * Ações oferecidas por status.
 *
 * É um subconjunto das transições permitidas em lib/dominio.ts — a UI mostra o
 * caminho normal do processo, e o servidor é quem de fato valida.
 */
const ACOES_POR_STATUS: Record<Status, Status[]> = {
  PENDENTE: ['APROVADO', 'REJEITADO'],
  APROVADO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['CANCELADO'],
  REJEITADO: [],
  CANCELADO: [],
}

type ConflitoNaLista = {
  id: number
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  status: string
}

type ConflitoAgendaFixaNaLista = {
  titulo: string
  responsavel: string
  horaInicio: string
  horaFim: string
}

export function CartaoReserva({
  reserva: r,
  conflito,
  conflitoAgendaFixa,
}: {
  reserva: Reserva
  /** Outra reserva que ocupa o mesmo espaço no mesmo horário, se houver — ver mapearConflitos. */
  conflito?: ConflitoNaLista | null
  /** Agenda fixa que ocupa o mesmo espaço no mesmo horário, se houver — ver mapearConflitosComAgendaFixa. */
  conflitoAgendaFixa?: ConflitoAgendaFixaNaLista | null
}) {
  const [estado, acao] = useActionState<EstadoAcao, FormData>(mudarStatus, {})
  const [aberto, setAberto] = useState(false)
  // Ação destrutiva aguardando confirmação, ou null.
  const [confirmando, setConfirmando] = useState<Status | null>(null)

  const status = r.status as Status
  const disponiveis = ACOES_POR_STATUS[status] ?? []
  const espaco = ESPACOS[r.espaco as Espaco] ?? r.espaco
  const vinculo = r.tipoVinculo
    ? (TIPOS_VINCULO[r.tipoVinculo as TipoVinculo] ?? r.tipoVinculo)
    : null
  const ehPassada = r.data < hoje()
  const importada = r.origem === 'GOOGLE_AGENDA'

  return (
    <article className={`cartao overflow-hidden ${ehPassada ? 'opacity-70' : ''}`}>
      {/* ---------- Cabeçalho: o que decide a triagem ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta status={status} />
            <span className="font-mono text-xs text-tinta-fraca">{protocolo(r.id)}</span>
            {ehPassada && (
              <span className="etiqueta bg-fundo text-tinta-suave ring-1 ring-borda-forte">
                data passada
              </span>
            )}
            {importada && (
              <span className="etiqueta bg-fundo text-tinta-suave ring-1 ring-borda-forte">
                importada da agenda
              </span>
            )}
          </div>

          <h3 className="mt-2 font-semibold text-tinta">{espaco}</h3>
          <p className="text-sm text-tinta-suave">
            {formatarDataPorExtenso(r.data)} · {formatarIntervalo(r.horaInicio, r.horaFim)}
          </p>
          <p className="mt-1 truncate text-sm text-tinta">
            {r.nomeSolicitante}
            {vinculo && (
              <>
                {' '}
                <span className="text-tinta-fraca">·</span> {vinculo}
              </>
            )}
          </p>

          {conflito && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-perigo">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Conflita com {protocolo(conflito.id)} ({STATUS[conflito.status as Status]} ·{' '}
              {formatarIntervalo(conflito.horaInicio, conflito.horaFim)})
            </p>
          )}

          {!conflito && conflitoAgendaFixa && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-perigo">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Conflita com a agenda fixa &ldquo;{conflitoAgendaFixa.titulo}&rdquo; (
              {conflitoAgendaFixa.responsavel} ·{' '}
              {formatarIntervalo(conflitoAgendaFixa.horaInicio, conflitoAgendaFixa.horaFim)})
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="botao-secundario shrink-0 px-3 text-xs"
        >
          {aberto ? 'Ocultar' : 'Ver detalhes'}
        </button>
      </div>

      {/* ---------- Detalhes ---------- */}
      {aberto && (
        <div className="border-t border-borda bg-fundo px-4 py-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Item termo="Nome completo" valor={r.nomeSolicitante} />
            {r.dataNascimento && (
              <Item
                termo="Data de nascimento"
                valor={`${r.dataNascimento.split('-').reverse().join('/')} (${idade(r.dataNascimento)} anos)`}
              />
            )}
            {r.telefone && (
              <Item termo="Telefone / WhatsApp" valor={formatarTelefone(r.telefone)} />
            )}
            {r.email && <Item termo="E-mail" valor={r.email} />}
            {vinculo && <Item termo="Vínculo" valor={vinculo} />}
            {r.codigoMembresia && <Item termo="Código de membresia" valor={r.codigoMembresia} />}
            {r.finalidade && (
              <div className="sm:col-span-2">
                <Item termo="Finalidade" valor={r.finalidade} />
              </div>
            )}
            <Item
              termo={importada ? 'Importada em' : 'Pedido enviado em'}
              valor={new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'America/Sao_Paulo',
              }).format(r.criadoEm)}
            />
          </dl>

          {r.observacaoAdmin && (
            <div className="mt-4 rounded-lg border border-borda bg-superficie p-3">
              <p className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">
                Observação interna
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-tinta">{r.observacaoAdmin}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------- Ações ---------- */}
      <form action={acao} className="border-t border-borda p-4">
        <input type="hidden" name="id" value={r.id} />

        {estado.erro && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-perigo/25 bg-perigo-fraca px-3 py-2 text-sm font-medium text-perigo"
          >
            {estado.erro}
          </p>
        )}

        {/* Painel de confirmação das ações destrutivas. Rejeitar e cancelar não
            têm desfazer, então exigem um segundo clique deliberado — e é aqui
            que entra a observação interna, no momento em que se tem o motivo
            fresco na cabeça. */}
        {confirmando ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-tinta">
              {ACOES[confirmando].pergunta}{' '}
              <span className="font-normal text-tinta-suave">
                O horário volta a ficar livre para novos pedidos.
              </span>
            </p>

            <div>
              <label htmlFor={`obs-${r.id}`} className="rotulo">
                Observação interna <span className="font-normal text-tinta-suave">(opcional)</span>
              </label>
              <textarea
                id={`obs-${r.id}`}
                name="observacao"
                rows={2}
                placeholder="Visível apenas no painel. Ex.: conflito com o culto de jovens."
                className="campo"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <BotaoAcao name="para" value={confirmando} className="botao-perigo">
                {ACOES[confirmando].confirmacao}
              </BotaoAcao>
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                className="botao-secundario"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {disponiveis.map((destino) => {
              const { rotulo, destrutiva } = ACOES[destino]

              // Destrutiva abre o painel de confirmação; as demais são um
              // clique só, para a triagem do dia a dia ser rápida.
              return destrutiva ? (
                <button
                  key={destino}
                  type="button"
                  onClick={() => setConfirmando(destino)}
                  className="botao-perigo"
                >
                  {rotulo}
                </button>
              ) : (
                <BotaoAcao key={destino} name="para" value={destino} className="botao-primario">
                  {rotulo}
                </BotaoAcao>
              )
            })}

            {/* O contato é por WhatsApp, fora do sistema: este link abre a
                conversa com a mensagem já escrita, pronta para revisar.
                Reservas importadas sem telefone no título não têm o botão. */}
            {r.telefone && (
            <a
              href={linkWhatsApp({ ...r, telefone: r.telefone }, status)}
              target="_blank"
              rel="noopener noreferrer"
              className="botao-secundario ml-auto"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.14.07-1.83-.11-.42-.13-.97-.31-1.66-.61-2.93-1.27-4.84-4.22-4.99-4.42-.14-.2-1.19-1.58-1.19-3.02 0-1.43.75-2.14 1.02-2.43.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.65.5.24.58.82 2.01.89 2.16.07.14.12.31.02.51-.1.2-.15.32-.29.49-.15.17-.31.38-.44.51-.15.14-.3.3-.13.59.17.29.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.33 1.44.29.14.46.12.63-.07.17-.2.73-.85.92-1.15.2-.29.39-.24.66-.14.27.09 1.7.8 1.99.95.29.14.48.22.55.34.07.12.07.7-.17 1.38Z" />
              </svg>
              WhatsApp
            </a>
            )}
          </div>
        )}
      </form>
    </article>
  )
}

function Item({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-tinta-suave uppercase">{termo}</dt>
      <dd className="mt-0.5 text-sm whitespace-pre-wrap text-tinta">{valor}</dd>
    </div>
  )
}

function BotaoAcao({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className={className} {...props}>
      {pending ? 'Salvando...' : children}
    </button>
  )
}

/** 11987654321 -> (11) 98765-4321 */
function formatarTelefone(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d
}
