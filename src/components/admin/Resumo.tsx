import Link from 'next/link'
import { STATUS, type Status } from '@/lib/dominio'

/**
 * Resumo por status das reservas futuras.
 *
 * A ordem não é alfabética nem a do enum: começa por PENDENTE porque é o único
 * estado que exige uma ação do Vitor. O painel deve responder "o que preciso
 * fazer agora?" antes de qualquer outra coisa.
 */
const ORDEM: Status[] = ['PENDENTE', 'APROVADO', 'CONFIRMADO', 'REJEITADO', 'CANCELADO']

const CORES: Record<Status, string> = {
  PENDENTE: 'text-alerta',
  APROVADO: 'text-info',
  CONFIRMADO: 'text-sucesso-forte',
  REJEITADO: 'text-perigo',
  CANCELADO: 'text-tinta-fraca',
}

export function Resumo({ contagens }: { contagens: Partial<Record<Status, number>> }) {
  return (
    <div>
      <h2 className="sr-only">Resumo das reservas futuras</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ORDEM.map((s) => {
          const n = contagens[s] ?? 0
          return (
            <li key={s}>
              <Link
                href={`/admin?status=${s}`}
                className="cartao block px-3 py-2.5 transition hover:border-borda-forte hover:shadow"
              >
                <span className={`block text-2xl font-bold tabular-nums ${CORES[s]}`}>{n}</span>
                <span className="mt-0.5 block text-xs leading-tight text-tinta-suave">
                  {STATUS[s]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
