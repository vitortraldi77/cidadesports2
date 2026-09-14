'use server'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { reservaSchema } from '@/lib/schemas'
import { ESPACOS, STATUS, VINCULO_EXIGE_MEMBRESIA, protocolo, type Status } from '@/lib/dominio'
import { dataValida, horaValida } from '@/lib/datas'
import { validarAntecedencia } from '@/lib/regras/antecedencia'
import { validarDuracao } from '@/lib/regras/duracao'
import {
  avisoDeConflito,
  avisoDeConflitoAgendaFixa,
  buscarConflito,
  buscarConflitoAgendaFixa,
  buscarReservaNoMesmoDia,
  mensagemDeConflito,
  mensagemDeConflitoAgendaFixa,
  mensagemDeLimiteDiario,
} from '@/lib/regras/conflito'

export type EstadoForm = {
  /** Erros por campo, para exibir junto de cada input. */
  erros?: Record<string, string[]>
  /** Erro geral (regra de negócio), exibido no topo do formulário. */
  mensagem?: string
  /** Valores digitados, devolvidos para não perder o preenchimento no erro. */
  valores?: Record<string, string>
  /**
   * Contador incrementado a cada resposta.
   *
   * O React 19 reseta o formulário quando uma action termina — e não restaura
   * nem os campos com defaultValue nem os controlados cujo state não mudou.
   * O componente usa este número como `key` dos campos: a cada resposta eles
   * remontam e reinicializam a partir de `valores`, que é o que de fato
   * preserva o preenchimento. Ver src/components/form/FormularioReserva.tsx.
   */
  chave?: number
}

export async function criarReserva(
  anterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const bruto = Object.fromEntries(formData) as Record<string, string>
  const chave = (anterior.chave ?? 0) + 1

  // Checkboxes só aparecem no FormData quando marcados; ausência = false.
  const entrada = {
    ...bruto,
    ciencia1: formData.get('ciencia1') === 'on',
    ciencia2: formData.get('ciencia2') === 'on',
    ciencia3: formData.get('ciencia3') === 'on',
    ciencia4: formData.get('ciencia4') === 'on',
    ciencia5: formData.get('ciencia5') === 'on',
  }

  // Devolvido em qualquer caminho de erro para repovoar o formulário.
  const valores = bruto

  // --- 1. Formato e coerência entre campos ---
  const parsed = reservaSchema.safeParse(entrada)
  if (!parsed.success) {
    const erros: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const campo = String(issue.path[0] ?? '_')
      ;(erros[campo] ??= []).push(issue.message)
    }
    return { erros, valores, chave }
  }

  const d = parsed.data

  // --- 2. Regras que não dependem do banco ---
  const antecedencia = validarAntecedencia(d.data)
  if (!antecedencia.ok) {
    return { erros: { data: [antecedencia.mensagem] }, valores, chave }
  }

  const duracao = validarDuracao(d.horaInicio, d.horaFim)
  if (!duracao.ok) {
    return { erros: { horaFim: [duracao.mensagem] }, valores, chave }
  }

  // O formulário já mostrou o aviso de conflito e pediu essa confirmação
  // antes de chegar aqui (ver verificarConflito, abaixo). Isto é a rede de
  // segurança para quando o aviso não rodou — JS desabilitado ou uma corrida
  // entre o aviso e o envio — e não o caminho principal.
  const confirmouConflito = formData.get('confirmarConflito') === 'on'

  // --- 3. Regras que dependem das outras reservas ---
  //
  // A checagem e a inserção rodam na mesma transação. Sem isso, dois envios
  // simultâneos para o mesmo horário passariam os dois pela checagem antes de
  // qualquer um gravar, e o conflito entraria no banco.
  //
  // Ressalva honesta: no SQLite isso reduz muito a janela, mas não a fecha por
  // completo. A garantia definitiva é uma exclusion constraint no Postgres
  // (ver README, seção "Migração para o Supabase") — no volume desta aplicação,
  // alguns pedidos por semana, a probabilidade prática é desprezível.
  let novoId: number

  try {
    novoId = await prisma.$transaction(async (tx) => {
      const conflito = await buscarConflito(tx, {
        espaco: d.espaco,
        data: d.data,
        horaInicio: d.horaInicio,
        horaFim: d.horaFim,
      })

      // Uma agenda fixa não é uma Reserva no banco, então só vale a pena
      // checá-la quando não há conflito com outra reserva — evita uma
      // consulta extra no caso comum.
      const conflitoFixo = conflito
        ? undefined
        : buscarConflitoAgendaFixa(
            await tx.agendaFixa.findMany({ where: { ativa: true, espaco: d.espaco } }),
            { espaco: d.espaco, data: d.data, horaInicio: d.horaInicio, horaFim: d.horaFim },
          )

      // Conflito de agenda não bloqueia mais por si só: se o solicitante já
      // confirmou ciência do aviso, o pedido segue como PENDENTE e cabe à
      // administração decidir qual reserva atender. Sem a confirmação, é
      // tratado como antes — provavelmente porque o aviso não teve tempo de
      // rodar antes deste envio.
      if ((conflito || conflitoFixo) && !confirmouConflito) {
        throw new ErroDeRegra(
          conflito
            ? mensagemDeConflito(d.espaco, d.data, conflito)
            : mensagemDeConflitoAgendaFixa(d.espaco, conflitoFixo!),
        )
      }

      const mesmoDia = await buscarReservaNoMesmoDia(tx, {
        email: d.email,
        data: d.data,
      })
      if (mesmoDia) {
        throw new ErroDeRegra(mensagemDeLimiteDiario(d.data, mesmoDia))
      }

      const criada = await tx.reserva.create({
        data: {
          nomeSolicitante: d.nomeSolicitante,
          dataNascimento: d.dataNascimento,
          telefone: d.telefone,
          email: d.email,
          tipoVinculo: d.tipoVinculo,
          // Guardar o código de quem não é membro seria lixo no banco.
          codigoMembresia:
            d.tipoVinculo === VINCULO_EXIGE_MEMBRESIA
              ? (d.codigoMembresia?.trim() || null)
              : null,
          espaco: d.espaco,
          data: d.data,
          horaInicio: d.horaInicio,
          horaFim: d.horaFim,
          finalidade: d.finalidade,
          status: 'PENDENTE',
          logs: {
            create: {
              de: null,
              para: 'PENDENTE',
              observacao: conflito
                ? `Pedido enviado com ciência do conflito de horário: sobrepõe a reserva ` +
                  `${protocolo(conflito.id)} (${STATUS[conflito.status as Status]}).`
                : conflitoFixo
                  ? `Pedido enviado com ciência do conflito de horário: sobrepõe a agenda fixa ` +
                    `"${conflitoFixo.titulo}" (${conflitoFixo.responsavel}).`
                  : 'Pedido enviado pelo formulário público.',
            },
          },
        },
        select: { id: true },
      })

      return criada.id
    })
  } catch (e) {
    if (e instanceof ErroDeRegra) return { mensagem: e.message, valores, chave }
    console.error('Falha ao criar reserva:', e)
    return {
      mensagem: 'Não foi possível registrar o pedido agora. Tente novamente em alguns instantes.',
      valores,
      chave,
    }
  }

  // redirect() lança internamente, então precisa ficar fora do try/catch.
  redirect(`/sucesso?p=${protocolo(novoId)}`)
}

class ErroDeRegra extends Error {}

/**
 * Checagem de conflito sob demanda, chamada pelo formulário assim que espaço,
 * data e horário estão preenchidos — antes de qualquer tentativa de envio.
 *
 * Não expõe dados do outro solicitante (nome, telefone, e-mail): só o
 * suficiente para explicar a sobreposição e o status da reserva existente.
 */
export async function verificarConflito(input: {
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
}): Promise<{ conflita: boolean; mensagem?: string; grave?: boolean }> {
  if (!(input.espaco in ESPACOS)) return { conflita: false }
  if (!dataValida(input.data)) return { conflita: false }
  if (!horaValida(input.horaInicio) || !horaValida(input.horaFim)) return { conflita: false }
  if (input.horaInicio >= input.horaFim) return { conflita: false }

  const conflito = await buscarConflito(prisma, input)
  if (conflito) {
    const aviso = avisoDeConflito(input.espaco, input.data, conflito)
    return { conflita: true, ...aviso }
  }

  const agendas = await prisma.agendaFixa.findMany({
    where: { ativa: true, espaco: input.espaco },
  })
  const conflitoFixo = buscarConflitoAgendaFixa(agendas, input)
  if (conflitoFixo) {
    const aviso = avisoDeConflitoAgendaFixa(input.espaco, conflitoFixo)
    return { conflita: true, ...aviso }
  }

  return { conflita: false }
}
