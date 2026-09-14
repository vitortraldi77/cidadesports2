import { CalendarClock } from 'lucide-react'
import { prisma } from '@/lib/db'
import { DIAS_SEMANA, ESPACOS, type DiaSemana, type Espaco } from '@/lib/dominio'
import { formatarData } from '@/lib/datas'
import { desativarAgendaFixa } from '@/app/actions/agendas'
import { FormularioAgendaFixa } from '@/components/admin/FormularioAgendaFixa'

export const dynamic = 'force-dynamic'

export default async function PaginaAgendasFixas() {
  const agendas = await prisma.agendaFixa.findMany({
    where: { ativa: true },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  })

  return (
    <div className="space-y-5">
      <FormularioAgendaFixa />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-tinta">
          Agendas fixas ativas
          {agendas.length > 0 && (
            <span className="ml-1.5 font-normal text-tinta-suave">({agendas.length})</span>
          )}
        </h2>

        {agendas.length === 0 ? (
          <div className="cartao px-6 py-14 text-center">
            <CalendarClock className="mx-auto size-8 text-tinta-fraca" aria-hidden />
            <p className="mt-3 font-medium text-tinta">Nenhuma agenda fixa cadastrada</p>
            <p className="mt-1 text-sm text-tinta-suave">
              Use o formulário acima para criar um compromisso recorrente.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {agendas.map((a) => (
              <li key={a.id} className="cartao flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-tinta">{a.titulo}</p>
                  <p className="text-sm text-tinta-suave">
                    {ESPACOS[a.espaco as Espaco] ?? a.espaco} · {DIAS_SEMANA[a.diaSemana as DiaSemana]} ·{' '}
                    {a.horaInicio} às {a.horaFim}
                  </p>
                  <p className="mt-1 text-sm text-tinta">
                    {a.responsavel}{' '}
                    <span className="text-tinta-fraca">
                      · a partir de {formatarData(a.dataInicio)}
                      {a.dataFim ? ` até ${formatarData(a.dataFim)}` : ' · sem data de término'}
                    </span>
                  </p>
                </div>

                <form action={desativarAgendaFixa}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="botao-secundario shrink-0 text-xs">
                    Desativar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
