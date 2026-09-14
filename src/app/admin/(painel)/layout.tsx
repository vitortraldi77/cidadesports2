import { redirect } from 'next/navigation'
import { sessaoAtual } from '@/lib/auth'
import { sair } from '@/app/actions/admin'
import { Abas } from '@/components/admin/Abas'

/**
 * Guarda de autenticação do painel.
 *
 * Fica num route group `(painel)` para que /admin/login, que é irmão e está
 * fora do grupo, não herde esta verificação — do contrário a tela de login
 * redirecionaria para si mesma em loop.
 *
 * Cada Server Action de escrita revalida a sessão por conta própria
 * (`exigirSessao`). Este layout é a camada de navegação, não a de segurança:
 * um layout protege o que é renderizado, não o que é executado.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  if (!(await sessaoAtual())) redirect('/admin/login')

  return (
    <>
      <header className="sticky top-0 z-10 border-t-4 border-t-marca border-b border-b-borda bg-superficie">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="rotulo-kicker">Cidade Sports</p>
            <h1 className="titulo-display text-lg">Gestão de reservas</h1>
          </div>

          <form action={sair}>
            <button type="submit" className="botao-secundario">
              Sair
            </button>
          </form>
        </div>

        <div className="mx-auto max-w-5xl px-4">
          <Abas />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </>
  )
}
