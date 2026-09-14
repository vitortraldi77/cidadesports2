import { redirect } from 'next/navigation'
import { sessaoAtual } from '@/lib/auth'
import { FormularioLogin } from '@/components/admin/FormularioLogin'

export const dynamic = 'force-dynamic'

export default async function PaginaLogin() {
  // Já logado não precisa ver a tela de login.
  if (await sessaoAtual()) redirect('/admin')

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 items-center px-4 py-10">
      <div className="w-full">
        <div className="mb-6 text-center">
          <p className="rotulo-kicker">Igreja da Cidade</p>
          <h1 className="titulo-display mt-1 text-2xl">Painel · Cidade Sports</h1>
          <p className="mt-1 text-sm text-tinta-suave">Acesso restrito à gestão dos espaços.</p>
        </div>

        <div className="cartao border-t-4 border-t-marca p-6">
          <FormularioLogin />
        </div>
      </div>
    </main>
  )
}
