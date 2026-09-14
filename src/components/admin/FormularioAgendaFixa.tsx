'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { criarAgendaFixa, type EstadoAgendaFixa } from '@/app/actions/agendas'
import { DIAS_SEMANA, ESPACOS } from '@/lib/dominio'
import { hoje } from '@/lib/datas'

export function FormularioAgendaFixa() {
  const [estado, acao] = useActionState<EstadoAgendaFixa, FormData>(criarAgendaFixa, {})

  return (
    <div className="cartao p-5 sm:p-6">
      <h2 className="text-base font-semibold text-tinta">Nova agenda fixa</h2>
      <p className="mt-1 text-sm text-tinta-suave">
        Um compromisso recorrente — treino semanal, culto, aula — que ocupa o espaço direto,
        sem passar pelo fluxo de avaliação do formulário público.
      </p>

      <form action={acao} key={estado.chave ?? 0} className="mt-4 space-y-4">
        {estado.mensagem && (
          <div
            role="alert"
            className="flex gap-3 rounded-[10px] border border-perigo/25 bg-perigo-fraca p-4"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-perigo" aria-hidden />
            <p className="text-sm text-tinta">{estado.mensagem}</p>
          </div>
        )}

        {estado.sucesso && (
          <div
            role="status"
            className="flex gap-3 rounded-[10px] border border-sucesso/25 bg-sucesso-fraca p-4"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sucesso-forte" aria-hidden />
            <p className="text-sm text-tinta">{estado.sucesso}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="titulo" rotulo="Título" erros={estado.erros?.titulo}>
            <input
              id="titulo"
              name="titulo"
              type="text"
              placeholder="Treino do time de vôlei"
              defaultValue={estado.valores?.titulo}
              className="campo"
            />
          </Campo>

          <Campo id="responsavel" rotulo="Responsável" erros={estado.erros?.responsavel}>
            <input
              id="responsavel"
              name="responsavel"
              type="text"
              placeholder="Ministério de Jovens"
              defaultValue={estado.valores?.responsavel}
              className="campo"
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="espaco" rotulo="Espaço" erros={estado.erros?.espaco}>
            <select
              id="espaco"
              name="espaco"
              defaultValue={estado.valores?.espaco ?? ''}
              className="campo"
            >
              <option value="">Selecione...</option>
              {Object.entries(ESPACOS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>

          <Campo id="diaSemana" rotulo="Dia da semana" erros={estado.erros?.diaSemana}>
            <select
              id="diaSemana"
              name="diaSemana"
              defaultValue={estado.valores?.diaSemana ?? ''}
              className="campo"
            >
              <option value="">Selecione...</option>
              {Object.entries(DIAS_SEMANA).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Campo id="horaInicio" rotulo="Início" erros={estado.erros?.horaInicio}>
            <input
              id="horaInicio"
              name="horaInicio"
              type="time"
              step={900}
              defaultValue={estado.valores?.horaInicio}
              className="campo"
            />
          </Campo>

          <Campo id="horaFim" rotulo="Término" erros={estado.erros?.horaFim}>
            <input
              id="horaFim"
              name="horaFim"
              type="time"
              step={900}
              defaultValue={estado.valores?.horaFim}
              className="campo"
            />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="dataInicio" rotulo="Vigente a partir de" erros={estado.erros?.dataInicio}>
            <input
              id="dataInicio"
              name="dataInicio"
              type="date"
              defaultValue={estado.valores?.dataInicio ?? hoje()}
              className="campo"
            />
          </Campo>

          <Campo
            id="dataFim"
            rotulo="Até (opcional)"
            ajuda="Deixe em branco para vigência indefinida."
            erros={estado.erros?.dataFim}
          >
            <input
              id="dataFim"
              name="dataFim"
              type="date"
              defaultValue={estado.valores?.dataFim}
              className="campo"
            />
          </Campo>
        </div>

        <BotaoCriar />
      </form>
    </div>
  )
}

function Campo({
  id,
  rotulo,
  ajuda,
  erros,
  children,
}: {
  id: string
  rotulo: string
  ajuda?: string
  erros?: string[]
  children: React.ReactNode
}) {
  const invalido = Boolean(erros?.length)

  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
      </label>
      {children}
      {ajuda && <p className="ajuda">{ajuda}</p>}
      {invalido && (
        <p className="erro" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{erros!.join(' ')}</span>
        </p>
      )}
    </div>
  )
}

function BotaoCriar() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className="botao-primario w-full sm:w-auto">
      {pending ? 'Criando...' : 'Criar agenda fixa'}
    </button>
  )
}
