import { prisma } from '@/lib/db'
import { STATUS_QUE_OCUPAM } from '@/lib/dominio'
import { dataValida, diaDaSemana, diasDaSemana, hoje, inicioDaSemana } from '@/lib/datas'
import { Calendario } from '@/components/admin/Calendario'

export const dynamic = 'force-dynamic'

type Busca = {
  semana?: string
  espaco?: string
  liberadas?: string
}

export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<Busca>
}) {
  const f = await searchParams

  // `semana` é qualquer data dentro da semana desejada; normalizamos para a
  // segunda-feira. Assim o link "próxima semana" pode simplesmente somar 7
  // dias sem se preocupar com qual dia caiu na URL.
  const referencia = f.semana && dataValida(f.semana) ? f.semana : hoje()
  const segunda = inicioDaSemana(referencia)
  const dias = diasDaSemana(segunda)

  const incluirLiberadas = f.liberadas === '1'

  const [reservas, agendasFixas] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        // Como as datas são strings "YYYY-MM-DD", o intervalo da semana é uma
        // comparação lexicográfica simples entre a segunda e o domingo.
        data: { gte: dias[0], lte: dias[6] },
        ...(f.espaco ? { espaco: f.espaco } : {}),
        ...(incluirLiberadas ? {} : { status: { in: STATUS_QUE_OCUPAM } }),
      },
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
    }),
    prisma.agendaFixa.findMany({
      where: { ativa: true, ...(f.espaco ? { espaco: f.espaco } : {}) },
    }),
  ])

  // Agenda fixa não é uma linha por semana no banco — é a regra em si. Os
  // blocos desta semana são calculados aqui: para cada dia exibido, cada
  // agenda cujo dia da semana bate e cuja vigência cobre a data vira um
  // "pseudo-reserva" só para o Calendario desenhar. Ids negativos evitam
  // colidir com ids de Reserva de verdade.
  const blocosFixos = dias.flatMap((dia) =>
    agendasFixas
      .filter(
        (a) =>
          diaDaSemana(dia) === a.diaSemana &&
          dia >= a.dataInicio &&
          (a.dataFim === null || dia <= a.dataFim),
      )
      .map((a) => ({
        id: -a.id,
        nomeSolicitante: a.responsavel,
        espaco: a.espaco,
        data: dia,
        horaInicio: a.horaInicio,
        horaFim: a.horaFim,
        status: 'AGENDA_FIXA',
        finalidade: a.titulo,
      })),
  )

  return (
    <Calendario
      dias={dias}
      semana={segunda}
      reservas={[...reservas, ...blocosFixos]}
      espaco={f.espaco ?? ''}
      incluirLiberadas={incluirLiberadas}
      hoje={hoje()}
    />
  )
}
