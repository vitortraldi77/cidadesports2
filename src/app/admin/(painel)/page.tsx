import { prisma } from '@/lib/db'
import { STATUS, STATUS_QUE_OCUPAM, type Status } from '@/lib/dominio'
import { hoje } from '@/lib/datas'
import { mapearConflitos, mapearConflitosComAgendaFixa } from '@/lib/regras/conflito'
import { Filtros } from '@/components/admin/Filtros'
import { CartaoReserva } from '@/components/admin/CartaoReserva'
import { Resumo } from '@/components/admin/Resumo'

export const dynamic = 'force-dynamic'

type Busca = {
  status?: string
  espaco?: string
  data?: string
  passadas?: string
}

export default async function PainelReservas({
  searchParams,
}: {
  searchParams: Promise<Busca>
}) {
  const f = await searchParams
  const hojeISO = hoje()

  const status = f.status && f.status in STATUS ? (f.status as Status) : undefined
  const incluirPassadas = f.passadas === '1'

  const where = {
    ...(status ? { status } : {}),
    ...(f.espaco ? { espaco: f.espaco } : {}),
    // Uma data específica vence o filtro de passadas: se o Vitor pediu aquele
    // dia, é aquele dia que ele quer ver, esteja no passado ou não.
    ...(f.data
      ? { data: f.data }
      : incluirPassadas
        ? {}
        : { data: { gte: hojeISO } }),
  }

  const [reservas, contagens] = await Promise.all([
    prisma.reserva.findMany({
      where,
      orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
      take: 200,
    }),
    // Contagem por status para o resumo do topo — sempre sobre reservas
    // futuras, que é o que exige ação.
    prisma.reserva.groupBy({
      by: ['status'],
      where: { data: { gte: hojeISO } },
      _count: { _all: true },
    }),
  ])

  const resumo = Object.fromEntries(
    contagens.map((c) => [c.status, c._count._all]),
  ) as Partial<Record<Status, number>>

  // Conflitos dentro da lista atual: um pedido PENDENTE ou APROVADO pode
  // concorrer pelo mesmo horário com outro que o filtro da tela esconde (por
  // status, por exemplo) — por isso a busca de candidatas ignora o filtro e
  // olha só espaço+data, mas continua restrita ao que ocupa a agenda.
  const espacosNaLista = [...new Set(reservas.map((r) => r.espaco))]
  const datasNaLista = [...new Set(reservas.map((r) => r.data))]

  const candidatas =
    reservas.length > 0
      ? await prisma.reserva.findMany({
          where: {
            status: { in: STATUS_QUE_OCUPAM },
            espaco: { in: espacosNaLista },
            data: { in: datasNaLista },
          },
          select: { id: true, espaco: true, data: true, horaInicio: true, horaFim: true, status: true },
        })
      : []

  const alvosParaConflito = reservas.filter((r) => STATUS_QUE_OCUPAM.includes(r.status as Status))
  const conflitos = mapearConflitos(alvosParaConflito, candidatas)

  // Mesma ideia, contra agendas fixas: só vale checar quem já não tem
  // conflito com outra reserva, para o cartão mostrar um aviso só.
  const semConflitoDeReserva = alvosParaConflito.filter((r) => !conflitos.has(r.id))
  const agendasFixasAtivas =
    espacosNaLista.length > 0
      ? await prisma.agendaFixa.findMany({
          where: { ativa: true, espaco: { in: espacosNaLista } },
        })
      : []
  const conflitosFixos = mapearConflitosComAgendaFixa(semConflitoDeReserva, agendasFixasAtivas)

  return (
    <div className="space-y-5">
      <Resumo contagens={resumo} />

      <Filtros
        status={f.status ?? ''}
        espaco={f.espaco ?? ''}
        data={f.data ?? ''}
        passadas={incluirPassadas}
      />

      {reservas.length === 0 ? (
        <div className="cartao px-6 py-14 text-center">
          <p className="font-medium text-tinta">Nenhuma reserva encontrada</p>
          <p className="mt-1 text-sm text-tinta-suave">
            Ajuste os filtros acima ou marque &ldquo;incluir datas passadas&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-tinta-suave">
            {reservas.length === 1
              ? '1 reserva encontrada'
              : `${reservas.length} reservas encontradas`}
            {reservas.length === 200 && ' (exibindo as 200 primeiras)'}
          </p>

          <ul className="space-y-3">
            {reservas.map((r) => (
              <li key={r.id}>
                <CartaoReserva
                  reserva={r}
                  conflito={conflitos.get(r.id) ?? null}
                  conflitoAgendaFixa={conflitosFixos.get(r.id) ?? null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
