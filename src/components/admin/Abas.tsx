'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ABAS = [
  { href: '/admin', rotulo: 'Lista' },
  { href: '/admin/calendario', rotulo: 'Calendário' },
  { href: '/admin/agendas', rotulo: 'Agendas fixas' },
] as const

export function Abas() {
  const caminho = usePathname()

  return (
    <nav aria-label="Seções do painel" className="-mb-px flex gap-1">
      {ABAS.map((aba) => {
        // Comparação exata: /admin não pode ficar ativa em /admin/calendario.
        const ativa = caminho === aba.href

        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? 'page' : undefined}
            className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              ativa
                ? 'border-marca text-marca-forte'
                : 'border-transparent text-tinta-suave hover:border-borda-forte hover:text-tinta'
            }`}
          >
            {aba.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}
