'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { criarReserva, verificarConflito, type EstadoForm } from '@/app/actions/criar-reserva'
import { Campo } from './Campo'
import { ESPACOS, REGRAS, TIPOS_VINCULO, VINCULO_EXIGE_MEMBRESIA } from '@/lib/dominio'
import { duracaoEmMinutos, formatarData, horaValida } from '@/lib/datas'

type AvisoConflito = { mensagem: string; grave: boolean }

const CIENCIAS = [
  'Estou ciente da antecedência mínima de 3 dias úteis.',
  'Estou ciente de que o envio do formulário NÃO garante a reserva.',
  'Estou ciente de que devo aguardar confirmação oficial antes de usar o espaço.',
  'Estou ciente de que sem confirmação não estou autorizado a usar o espaço.',
  'Estou ciente do limite de 1 espaço por dia por responsável, máximo 2h.',
] as const

/** Aplica a máscara (11) 98765-4321 conforme se digita. */
function mascararTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function formatarDuracao(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function FormularioReserva({ dataMinima }: { dataMinima: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(criarReserva, {})

  return (
    <form action={acao} noValidate className="space-y-6">
      {/*
        A `key` que muda a cada resposta da action é o que preserva o
        preenchimento em caso de erro.

        Quando uma action termina, o React reseta o <form>: selects e
        checkboxes voltam ao estado inicial no DOM. Campos com defaultValue não
        são reaplicados (defaultValue só vale na montagem) e campos controlados
        também não, porque o state deles não mudou — do ponto de vista do React
        não há nada para atualizar, mesmo que o DOM já esteja diferente. O
        resultado seria um formulário que diz "Membro da Igreja" no state e
        mostra "Selecione..." na tela.

        Remontar os campos com uma chave nova resolve os dois casos de uma vez:
        tudo é reinicializado a partir de `estado.valores`, que é o que o
        usuário havia digitado.
      */}
      <Campos key={estado.chave ?? 0} estado={estado} dataMinima={dataMinima} />
    </form>
  )
}

function Campos({ estado, dataMinima }: { estado: EstadoForm; dataMinima: string }) {
  const v = estado.valores ?? {}

  const [vinculo, setVinculo] = useState(v.tipoVinculo ?? '')
  const [telefone, setTelefone] = useState(mascararTelefone(v.telefone ?? ''))
  const [espaco, setEspaco] = useState(v.espaco ?? '')
  const [data, setData] = useState(v.data ?? '')
  const [inicio, setInicio] = useState(v.horaInicio ?? '')
  const [fim, setFim] = useState(v.horaFim ?? '')
  // Checkboxes chegam no FormData como "on" quando marcados.
  const [ciencias, setCiencias] = useState<boolean[]>(() =>
    Array.from({ length: 5 }, (_, i) => v[`ciencia${i + 1}`] === 'on'),
  )

  const [conflito, setConflito] = useState<AvisoConflito | null>(null)
  const [cienciaConflito, setCienciaConflito] = useState(false)

  const ehMembro = vinculo === VINCULO_EXIGE_MEMBRESIA
  const todasCiencias = ciencias.every(Boolean)

  /**
   * Aviso de conflito, consultado ao vivo assim que espaço, data e horário
   * fazem sentido juntos — antes de qualquer tentativa de envio. Debounced
   * porque cada tecla no horário dispararia uma consulta.
   *
   * `cienciaConflito` reseta a cada nova checagem de propósito: se o
   * solicitante já havia confirmado ciência e muda o horário para outro que
   * também conflita, a confirmação anterior não vale para esta nova situação.
   */
  useEffect(() => {
    const pronto = Boolean(espaco && data && horaValida(inicio) && horaValida(fim) && inicio < fim)
    let cancelado = false

    const tempo = setTimeout(() => {
      if (cancelado) return

      if (!pronto) {
        setConflito(null)
        setCienciaConflito(false)
        return
      }

      verificarConflito({ espaco, data, horaInicio: inicio, horaFim: fim }).then((resultado) => {
        if (cancelado) return
        setConflito(resultado.conflita ? { mensagem: resultado.mensagem!, grave: !!resultado.grave } : null)
        setCienciaConflito(false)
      })
    }, 400)

    return () => {
      cancelado = true
      clearTimeout(tempo)
    }
  }, [espaco, data, inicio, fim])

  /**
   * Feedback de duração ao vivo. A mesma regra é revalidada no servidor — isto
   * aqui existe só para o usuário não descobrir o problema depois de preencher
   * o formulário inteiro.
   */
  const avisoDuracao = useMemo(() => {
    if (!horaValida(inicio) || !horaValida(fim)) return null

    const min = duracaoEmMinutos(inicio, fim)

    if (min <= 0) {
      return { tipo: 'erro' as const, texto: 'O término precisa ser depois do início.' }
    }
    if (min > REGRAS.DURACAO_MAXIMA_MINUTOS) {
      return {
        tipo: 'erro' as const,
        texto: `Duração de ${formatarDuracao(min)} — o limite é de 2 horas.`,
      }
    }
    return { tipo: 'ok' as const, texto: `Duração: ${formatarDuracao(min)}.` }
  }, [inicio, fim])

  const erros = estado.erros ?? {}

  return (
    <>
      {/* Erro de regra de negócio (conflito, limite diário): sempre no topo,
          que é onde o usuário olha depois de um envio recusado. */}
      {estado.mensagem && (
        <div role="alert" className="flex gap-3 rounded-[10px] border border-perigo/25 bg-perigo-fraca p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-perigo" aria-hidden />
          <div>
            <p className="font-semibold text-perigo">Não foi possível registrar o pedido</p>
            <p className="mt-1 text-sm text-tinta">{estado.mensagem}</p>
          </div>
        </div>
      )}

      {/* ---------- 1. Dados do solicitante ---------- */}
      <Secao titulo="Seus dados" numero={1}>
        <Campo id="nomeSolicitante" rotulo="Nome completo" obrigatorio erros={erros.nomeSolicitante}>
          {({ id, invalido, descritoPor }) => (
            <input
              id={id}
              name={id}
              type="text"
              autoComplete="name"
              defaultValue={v.nomeSolicitante}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>

        <Campo id="dataNascimento" rotulo="Data de nascimento" obrigatorio erros={erros.dataNascimento}>
          {({ id, invalido, descritoPor }) => (
            <input
              id={id}
              name={id}
              type="date"
              autoComplete="bday"
              defaultValue={v.dataNascimento}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>

        <Campo
          id="telefone"
          rotulo="Telefone / WhatsApp"
          ajuda="É por aqui que você receberá o retorno sobre a reserva."
          obrigatorio
          erros={erros.telefone}
        >
          {({ id, invalido, descritoPor }) => (
            <input
              id={id}
              name={id}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(11) 98765-4321"
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>

        <Campo
          id="email"
          rotulo="E-mail"
          ajuda="Identifica você como responsável pela reserva."
          obrigatorio
          erros={erros.email}
        >
          {({ id, invalido, descritoPor }) => (
            <input
              id={id}
              name={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={v.email}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>
      </Secao>

      {/* ---------- 2. Vínculo ---------- */}
      <Secao titulo="Vínculo com a igreja" numero={2}>
        <Campo id="tipoVinculo" rotulo="Qual o seu vínculo?" obrigatorio erros={erros.tipoVinculo}>
          {({ id, invalido, descritoPor }) => (
            /* defaultValue, e não value: um <select> controlado não sobrevive
               ao reset que o React aplica ao <form> quando a action termina —
               ele volta para a primeira opção no DOM enquanto o state segue
               com o valor antigo. O state aqui é só um espelho, usado para
               decidir se o campo de membresia aparece. */
            <select
              id={id}
              name={id}
              defaultValue={vinculo}
              onChange={(e) => setVinculo(e.target.value)}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            >
              <option value="">Selecione...</option>
              {Object.entries(TIPOS_VINCULO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>

        {/* Só existe no DOM quando aplicável: assim não vai no FormData nem é
            anunciado por leitores de tela quando não faz sentido. */}
        {ehMembro && (
          <Campo
            id="codigoMembresia"
            rotulo="Código de membresia"
            ajuda="O código que consta na sua carteirinha de membro."
            obrigatorio
            erros={erros.codigoMembresia}
          >
            {({ id, invalido, descritoPor }) => (
              <input
                id={id}
                name={id}
                type="text"
                defaultValue={v.codigoMembresia}
                aria-invalid={invalido}
                aria-describedby={descritoPor}
                className={`campo ${invalido ? 'campo-invalido' : ''}`}
              />
            )}
          </Campo>
        )}
      </Secao>

      {/* ---------- 3. Dados da reserva ---------- */}
      <Secao titulo="Dados da reserva" numero={3}>
        <Campo id="espaco" rotulo="Espaço desejado" obrigatorio erros={erros.espaco}>
          {({ id, invalido, descritoPor }) => (
            <select
              id={id}
              name={id}
              defaultValue={espaco}
              onChange={(e) => setEspaco(e.target.value)}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            >
              <option value="">Selecione...</option>
              {Object.entries(ESPACOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <Campo
          id="data"
          rotulo="Data desejada"
          ajuda={`A data mais próxima disponível é ${formatarData(dataMinima)}, pela antecedência de 3 dias úteis.`}
          obrigatorio
          erros={erros.data}
        >
          {({ id, invalido, descritoPor }) => (
            <input
              id={id}
              name={id}
              type="date"
              min={dataMinima}
              defaultValue={data}
              onChange={(e) => setData(e.target.value)}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo id="horaInicio" rotulo="Início" obrigatorio erros={erros.horaInicio}>
            {({ id, invalido, descritoPor }) => (
              <input
                id={id}
                name={id}
                type="time"
                step={900}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                aria-invalid={invalido}
                aria-describedby={descritoPor}
                className={`campo ${invalido ? 'campo-invalido' : ''}`}
              />
            )}
          </Campo>

          <Campo id="horaFim" rotulo="Término" obrigatorio erros={erros.horaFim}>
            {({ id, invalido, descritoPor }) => (
              <input
                id={id}
                name={id}
                type="time"
                step={900}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                aria-invalid={invalido}
                aria-describedby={descritoPor}
                className={`campo ${invalido ? 'campo-invalido' : ''}`}
              />
            )}
          </Campo>
        </div>

        {avisoDuracao && (
          <p
            aria-live="polite"
            className={`text-sm font-medium ${
              avisoDuracao.tipo === 'erro' ? 'text-perigo' : 'text-sucesso-forte'
            }`}
          >
            {avisoDuracao.texto}
          </p>
        )}

        {conflito && (
          <div
            role="alert"
            className={`rounded-[10px] border p-4 ${
              conflito.grave ? 'border-perigo/25 bg-perigo-fraca' : 'border-alerta/25 bg-alerta-fraca'
            }`}
          >
            <p
              className={`flex items-start gap-2 text-sm font-semibold ${
                conflito.grave ? 'text-perigo' : 'text-alerta'
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Conflito de agenda
            </p>
            <p className="mt-1 text-sm text-tinta">{conflito.mensagem}</p>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-tinta">
              <input
                type="checkbox"
                name="confirmarConflito"
                checked={cienciaConflito}
                onChange={(e) => setCienciaConflito(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 rounded border-borda-forte accent-marca focus:ring-2 focus:ring-marca/25"
              />
              <span>Estou ciente do conflito e quero manter minha solicitação mesmo assim.</span>
            </label>
          </div>
        )}

        <Campo
          id="finalidade"
          rotulo="Finalidade da reserva"
          ajuda="Ex.: treino do time de vôlei do ministério de jovens."
          obrigatorio
          erros={erros.finalidade}
        >
          {({ id, invalido, descritoPor }) => (
            <textarea
              id={id}
              name={id}
              rows={4}
              defaultValue={v.finalidade}
              aria-invalid={invalido}
              aria-describedby={descritoPor}
              className={`campo resize-y ${invalido ? 'campo-invalido' : ''}`}
            />
          )}
        </Campo>
      </Secao>

      {/* ---------- 4. Ciência ---------- */}
      <Secao titulo="Confirmação de ciência" numero={4}>
        <p className="text-sm text-tinta-suave">
          Marque todas as opções abaixo para poder enviar o pedido.
        </p>

        <fieldset className="space-y-2.5">
          <legend className="sr-only">Confirmações de ciência</legend>
          {CIENCIAS.map((texto, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-borda bg-superficie p-3 transition hover:border-borda-forte has-checked:border-marca has-checked:bg-marca-fraca"
            >
              <input
                type="checkbox"
                name={`ciencia${i + 1}`}
                checked={ciencias[i]}
                onChange={(e) =>
                  setCiencias((prev) => prev.map((c, j) => (j === i ? e.target.checked : c)))
                }
                className="mt-0.5 size-5 shrink-0 rounded border-borda-forte text-marca accent-marca focus:ring-2 focus:ring-marca/25"
              />
              <span className="text-sm leading-snug text-tinta">{texto}</span>
            </label>
          ))}
        </fieldset>

        {erros.ciencia1 && (
          <p className="erro" role="alert">
            <span>{erros.ciencia1[0]}</span>
          </p>
        )}
      </Secao>

      <BotaoEnviar
        habilitado={todasCiencias && (!conflito || cienciaConflito)}
        aguardandoConflito={todasCiencias && !!conflito && !cienciaConflito}
      />
    </>
  )
}

function Secao({
  titulo,
  numero,
  children,
}: {
  titulo: string
  numero: number
  children: React.ReactNode
}) {
  return (
    <section className="cartao p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-2.5 text-base font-semibold text-tinta">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">
          {numero}
        </span>
        {titulo}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function BotaoEnviar({
  habilitado,
  aguardandoConflito,
}: {
  habilitado: boolean
  aguardandoConflito: boolean
}) {
  // useFormStatus só enxerga o envio se este componente estiver DENTRO do
  // <form> — por isso ele é um componente separado, e não JSX inline acima.
  const { pending } = useFormStatus()

  return (
    <div className="sticky bottom-0 -mx-4 border-t border-borda bg-superficie px-4 py-3 sm:mx-0 sm:rounded-[10px] sm:border">
      <button type="submit" disabled={!habilitado || pending} className="botao-primario w-full">
        {pending ? 'Enviando...' : 'Enviar pedido de reserva'}
      </button>
      {!habilitado && (
        <p className="mt-2 text-center text-xs text-tinta-suave">
          {aguardandoConflito
            ? 'Marque a ciência do conflito de agenda para habilitar o envio.'
            : 'Marque as 5 confirmações de ciência para habilitar o envio.'}
        </p>
      )}
    </div>
  )
}
