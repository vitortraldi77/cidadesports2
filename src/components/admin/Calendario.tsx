import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ESPACOS,
  ESPACOS_CURTOS,
  STATUS,
  type Espaco,
  type Status,
} from '@/lib/dominio'
import {
  diaCurto,
  diaEMes,
  diaDaSemana,
  formatarDataPorExtenso,
  somaDias,
} from '@/lib/datas'
import { distribuirEmFaixas, faixaDeHoras } from '@/lib/calendario'
import { protocolo } from '@/lib/dominio'

type Reserva = {
  id: number
  nomeSolicitante: string
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
  status: string
  finalidade: string | null
}

type Props = {
  dias: string[]
  semana: string
  reservas: Reserva[]
  espaco: string
  incluirLiberadas: boolean
  hoje: string
}

/** Altura de uma hora na grade, em pixels. */
const ALTURA_HORA = 56

/**
 * Cor por espaço, não por status.
 *
 * No calendário a pergunta é "qual espaço está ocupado quando" — o status vem
 * em segundo plano, pela borda e pelo rótulo. Na lista é o contrário, e por
 * isso lá a cor é do status.
 *
 * As cores vêm do sistema de "acento por família de esporte" do design
 * system do Cidade Sports: quadra/futsal, água e campo/areia — a tinta do
 * texto continua neutra (`text-tinta`), porque o acento aqui é decorativo,
 * nunca cor de texto corrido.
 */
const CORES: Record<Espaco, { bloco: string; ponto: string }> = {
  QUADRA_SOCIETY: { bloco: 'bg-quadra/10 border-quadra text-tinta', ponto: 'bg-quadra' },
  QUADRA_COBERTA: { bloco: 'bg-coberta/10 border-coberta text-tinta', ponto: 'bg-coberta' },
  VOLEI_AREIA: { bloco: 'bg-agua/10 border-agua text-tinta', ponto: 'bg-agua' },
  CAMPO_FUTEBOL: { bloco: 'bg-campo/15 border-campo text-tinta', ponto: 'bg-campo' },
  ESPACO_IGNICAO: { bloco: 'bg-ignicao/10 border-ignicao text-tinta', ponto: 'bg-ignicao' },
}

const LIBERADA = 'bg-fundo border-borda-forte text-tinta-suave'

export function Calendario({
  dias,
  semana,
  reservas,
  espaco,
  incluirLiberadas,
  hoje,
}: Props) {
  const { de, ate } = faixaDeHoras(reservas)
  const horas = Array.from({ length: ate - de }, (_, i) => de + i)
  const altura = (ate - de) * ALTURA_HORA

  function href(mudanca: Record<string, string>) {
    const p = new URLSearchParams()
    const atual = { semana, espaco, liberadas: incluirLiberadas ? '1' : '', ...mudanca }
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v)
    return `/admin/calendario?${p.toString()}`
  }

  const anoInicio = dias[0].slice(0, 4)
  const anoFim = dias[6].slice(0, 4)
  const periodo =
    anoInicio === anoFim
      ? `${diaEMes(dias[0])} a ${diaEMes(dias[6])} de ${anoInicio}`
      : `${diaEMes(dias[0])}/${anoInicio} a ${diaEMes(dias[6])}/${anoFim}`

  return (
    <div className="space-y-4">
      {/* ---------- Navegação e filtros ---------- */}
      <div className="cartao p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={href({ semana: somaDias(semana, -7) })}
              aria-label="Semana anterior"
              className="botao-secundario px-2.5"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <Link href={href({ semana: hoje })} className="botao-secundario">
              Hoje
            </Link>
            <Link
              href={href({ semana: somaDias(semana, 7) })}
              aria-label="Próxima semana"
              className="botao-secundario px-2.5"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <p className="text-sm font-semibold text-tinta">{periodo}</p>
        </div>

        {/* Filtro de espaço como links: mantém o estado na URL, igual à lista. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borda pt-3">
          <Chip href={href({ espaco: '' })} ativo={espaco === ''}>
            Todos os espaços
          </Chip>
          {(Object.keys(ESPACOS) as Espaco[]).map((e) => (
            <Chip key={e} href={href({ espaco: e })} ativo={espaco === e}>
              <span className={`size-2 rounded-full ${CORES[e].ponto}`} aria-hidden />
              {ESPACOS[e]}
            </Chip>
          ))}

          <Link
            href={href({ liberadas: incluirLiberadas ? '' : '1' })}
            className="ml-auto text-sm font-medium text-marca-forte underline-offset-2 hover:underline"
          >
            {incluirLiberadas ? 'Ocultar rejeitadas e canceladas' : 'Mostrar rejeitadas e canceladas'}
          </Link>
        </div>
      </div>

      {/* ---------- Resumo ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tinta-suave">
          {reservas.length === 0
            ? 'Nenhuma reserva nesta semana'
            : reservas.length === 1
              ? '1 reserva nesta semana'
              : `${reservas.length} reservas nesta semana`}
        </p>
        <p className="text-xs text-tinta-fraca sm:hidden">Arraste a grade para o lado →</p>
      </div>

      {/* ---------- Grade ---------- */}
      <div className="cartao overflow-x-auto">
        <div className="min-w-[860px]">
          {/* Cabeçalho dos dias */}
          <div
            className="grid border-b border-borda"
            style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
          >
            {/* Canto vazio. Fica fixo junto com a régua de horas. */}
            <div aria-hidden className="sticky left-0 z-20 bg-superficie" />
            {dias.map((d) => {
              const ehHoje = d === hoje
              const fimDeSemana = diaDaSemana(d) === 0 || diaDaSemana(d) === 6

              return (
                <div
                  key={d}
                  className={`border-l border-borda px-2 py-2 text-center ${
                    ehHoje ? 'bg-marca-fraca' : fimDeSemana ? 'bg-fundo' : ''
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase ${
                      ehHoje ? 'text-marca-forte' : 'text-tinta-suave'
                    }`}
                  >
                    {diaCurto(d)}
                  </p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      ehHoje ? 'text-marca-forte' : 'text-tinta'
                    }`}
                  >
                    {diaEMes(d)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Corpo */}
          <div style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }} className="grid">
            {/* Régua de horas. Fixa à esquerda: no celular a grade rola na
                horizontal, e sem isso a referência de hora sairia da tela
                justamente quando se olha o fim da semana. */}
            <div
              className="sticky left-0 z-20 border-r border-borda bg-superficie"
              style={{ height: altura }}
            >
              {horas.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 text-xs tabular-nums text-tinta-fraca"
                  style={{ top: (h - de) * ALTURA_HORA + 2 }}
                >
                  {String(h).padStart(2, '0')}h
                </div>
              ))}
            </div>

            {dias.map((d) => {
              const doDia = reservas.filter((r) => r.data === d)
              const blocos = distribuirEmFaixas(doDia)
              const ehHoje = d === hoje
              const fimDeSemana = diaDaSemana(d) === 0 || diaDaSemana(d) === 6

              return (
                <div
                  key={d}
                  className={`relative border-l border-borda ${
                    ehHoje ? 'bg-marca-fraca/40' : fimDeSemana ? 'bg-fundo/60' : ''
                  }`}
                  style={{ height: altura }}
                >
                  {/* Linhas das horas */}
                  {horas.map((h) => (
                    <div
                      key={h}
                      aria-hidden
                      className="absolute inset-x-0 border-t border-borda/70"
                      style={{ top: (h - de) * ALTURA_HORA }}
                    />
                  ))}

                  {blocos.map(({ item: r, inicio, fim, faixa, faixas }) => {
                    // Agenda fixa não é uma Reserva de verdade (id negativo,
                    // status sintético) — ver calendario/page.tsx. Ganha um
                    // visual sólido e escuro, de propósito bem diferente dos
                    // tons claros por espaço: é uma decisão já tomada, não
                    // mais uma reserva em algum ponto do fluxo de status.
                    const ehFixa = r.status === 'AGENDA_FIXA'
                    const status = r.status as Status
                    const liberada = !ehFixa && (status === 'REJEITADO' || status === 'CANCELADO')
                    const cor = ehFixa
                      ? 'border-tinta bg-tinta text-white'
                      : liberada
                        ? LIBERADA
                        : CORES[r.espaco as Espaco]?.bloco ?? LIBERADA

                    const topo = ((inicio - de * 60) / 60) * ALTURA_HORA
                    const alturaBloco = Math.max(((fim - inicio) / 60) * ALTURA_HORA, 22)

                    return (
                      <Link
                        key={r.id}
                        href={`/admin?data=${r.data}`}
                        title={
                          ehFixa
                            ? `Agenda fixa · ${ESPACOS[r.espaco as Espaco] ?? r.espaco}\n` +
                              `${formatarDataPorExtenso(r.data)}, ${r.horaInicio} às ${r.horaFim}\n` +
                              `${r.nomeSolicitante}${r.finalidade ? `\n\n${r.finalidade}` : ''}`
                            : `${protocolo(r.id)} · ${ESPACOS[r.espaco as Espaco] ?? r.espaco}\n` +
                              `${formatarDataPorExtenso(r.data)}, ${r.horaInicio} às ${r.horaFim}\n` +
                              `${r.nomeSolicitante}\n` +
                              `${STATUS[status]}${r.finalidade ? `\n\n${r.finalidade}` : ''}`
                        }
                        className={`absolute overflow-hidden rounded border-l-3 px-1.5 py-1 text-left transition hover:z-10 hover:shadow-md ${cor} ${
                          liberada ? 'opacity-70' : ''
                        } ${!ehFixa && status === 'PENDENTE' ? 'border-dashed' : ''}`}
                        style={{
                          top: topo + 1,
                          height: alturaBloco - 2,
                          // Faixas lado a lado quando há reservas simultâneas.
                          left: `calc(${(faixa / faixas) * 100}% + 2px)`,
                          width: `calc(${100 / faixas}% - 4px)`,
                        }}
                      >
                        {/* Em bloco dividido não cabe o intervalo inteiro, e
                            "15:00–..." truncado perde justamente o que mais
                            importa. Nesse caso fica só o início — o fim está
                            na altura do bloco, no tooltip e na lista. */}
                        <p className="truncate text-[11px] leading-tight font-bold tabular-nums">
                          {faixas > 1 ? r.horaInicio : `${r.horaInicio}–${r.horaFim}`}
                        </p>

                        {alturaBloco >= 44 && (
                          <p className="truncate text-[11px] leading-tight font-medium">
                            {ehFixa
                              ? `Fixo · ${ESPACOS_CURTOS[r.espaco as Espaco] ?? r.espaco}`
                              : ESPACOS_CURTOS[r.espaco as Espaco] ?? r.espaco}
                            {!ehFixa && status === 'PENDENTE' && ' · pendente'}
                          </p>
                        )}

                        {alturaBloco >= 72 && (
                          <p className="truncate text-[11px] leading-tight opacity-80">
                            {r.nomeSolicitante}
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ---------- Legenda ---------- */}
      <div className="cartao flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-xs text-tinta-suave">
        {(Object.keys(ESPACOS) as Espaco[]).map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${CORES[e].ponto}`} aria-hidden />
            {ESPACOS[e]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded border border-dashed border-tinta-fraca" aria-hidden />
          Pendente de avaliação
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded bg-tinta" aria-hidden />
          Agenda fixa
        </span>
        <span className="ml-auto">Clique em uma reserva para abrir o dia na lista.</span>
      </div>
    </div>
  )
}

function Chip({
  href,
  ativo,
  children,
}: {
  href: string
  ativo: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        ativo
          ? 'border-marca bg-marca-fraca text-marca-forte'
          : 'border-borda-forte bg-superficie text-tinta-suave hover:bg-fundo'
      }`}
    >
      {children}
    </Link>
  )
}
