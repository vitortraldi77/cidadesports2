import { FormularioReserva } from '@/components/form/FormularioReserva'
import { primeiraDataValida } from '@/lib/regras/antecedencia'

// A data mínima depende de "hoje", então a página não pode ser pré-renderizada
// em tempo de build — ficaria congelada na data do deploy.
export const dynamic = 'force-dynamic'

export default function PaginaPublica() {
  const dataMinima = primeiraDataValida()

  return (
    <>
      <header className="border-t-4 border-t-marca border-b border-b-borda bg-superficie">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <p className="rotulo-kicker">Igreja da Cidade</p>
          <h1 className="titulo-display mt-1 text-2xl">Reserva de espaços · Cidade Sports</h1>
          <p className="mt-2 text-sm leading-relaxed text-tinta-suave">
            Preencha o formulário para solicitar o uso de um dos espaços do Cidade Sports:
            quadras, campo ou Espaço Ignição.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {/* Repete o essencial antes do formulário: quem lê isto aqui evita
            preencher tudo para só então descobrir que o pedido não vale. */}
        <div className="mb-6 rounded-xl border border-info/20 bg-info-fraca p-4">
          <h2 className="text-sm font-semibold text-info">Antes de começar</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-tinta">
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>
                O pedido precisa ser feito com <strong>3 dias úteis de antecedência</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>
                Cada responsável pode reservar <strong>1 espaço por dia</strong>, por no máximo{' '}
                <strong>2 horas</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>
                Enviar o formulário <strong>não garante a reserva</strong>. Você receberá o
                retorno pelo WhatsApp informado.
              </span>
            </li>
          </ul>
        </div>

        <FormularioReserva dataMinima={dataMinima} />
      </main>

      <footer className="border-t border-borda bg-superficie">
        <div className="mx-auto max-w-2xl px-4 py-5 text-xs text-tinta-suave">
          Cidade Sports · Igreja da Cidade
        </div>
      </footer>
    </>
  )
}
