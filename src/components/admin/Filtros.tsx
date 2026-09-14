'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ESPACOS, STATUS } from '@/lib/dominio'

type Props = {
  status: string
  espaco: string
  data: string
  passadas: boolean
}

/**
 * Filtros do painel.
 *
 * O estado vive na URL, não em useState. Isso dá de graça três coisas que o
 * Vitor vai usar sem pensar: o botão voltar funciona, a página pode ser
 * recarregada sem perder o filtro, e um recorte específico ("pendentes do
 * campo") pode ser salvo nos favoritos.
 */
export function Filtros({ status, espaco, data, passadas }: Props) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  function aplicar(mudanca: Record<string, string | boolean>) {
    const atual: Record<string, string | boolean> = {
      status,
      espaco,
      data,
      passadas,
      ...mudanca,
    }
    const params = new URLSearchParams()

    for (const [k, v] of Object.entries(atual)) {
      const valor = v === true ? '1' : v === false ? '' : String(v)
      if (valor) params.set(k, valor)
    }

    iniciar(() => router.push(`/admin?${params.toString()}`))
  }

  const temFiltro = Boolean(status || espaco || data || passadas)

  return (
    <div className={`cartao p-4 transition-opacity ${pendente ? 'opacity-60' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="f-status" className="rotulo">
            Status
          </label>
          <select
            id="f-status"
            value={status}
            onChange={(e) => aplicar({ status: e.target.value })}
            className="campo"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-espaco" className="rotulo">
            Espaço
          </label>
          <select
            id="f-espaco"
            value={espaco}
            onChange={(e) => aplicar({ espaco: e.target.value })}
            className="campo"
          >
            <option value="">Todos</option>
            {Object.entries(ESPACOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-data" className="rotulo">
            Data
          </label>
          <input
            id="f-data"
            type="date"
            value={data}
            onChange={(e) => aplicar({ data: e.target.value })}
            className="campo"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-tinta">
          <input
            type="checkbox"
            checked={passadas}
            onChange={(e) => aplicar({ passadas: e.target.checked })}
            className="size-4 rounded border-borda-forte accent-marca"
          />
          Incluir datas passadas
        </label>

        {temFiltro && (
          <button
            type="button"
            onClick={() => iniciar(() => router.push('/admin'))}
            className="text-sm font-medium text-marca-forte underline-offset-2 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
