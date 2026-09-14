import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PaginaSucesso({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const { p } = await searchParams

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10">
      <div className="cartao w-full p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-sucesso-fraca">
          <CheckCircle2 className="size-7 text-sucesso-forte" aria-hidden />
        </div>

        <h1 className="titulo-display mt-4 text-2xl">Pedido enviado</h1>

        <p className="mt-2 text-sm leading-relaxed text-tinta-suave">
          Sua solicitação foi registrada e está{' '}
          <strong className="text-tinta">pendente de avaliação</strong>.
        </p>

        {p && (
          <div className="mt-5 rounded-lg border border-borda bg-fundo px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-tinta-suave uppercase">
              Número do protocolo
            </p>
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-tinta">{p}</p>
          </div>
        )}

        <div className="mt-5 rounded-lg border border-alerta/20 bg-alerta-fraca p-4 text-left">
          <p className="text-sm font-semibold text-alerta">O que acontece agora</p>
          <ol className="mt-2 space-y-1.5 text-sm text-tinta">
            <li>1. O responsável pelo Cidade Sports avalia o pedido.</li>
            <li>2. Você recebe o retorno pelo WhatsApp informado no formulário.</li>
            <li>
              3. <strong>Só após a confirmação oficial</strong> você está autorizado a usar o
              espaço.
            </li>
          </ol>
        </div>

        <Link href="/" className="botao-secundario mt-6 w-full">
          Fazer outro pedido
        </Link>
      </div>
    </main>
  )
}
