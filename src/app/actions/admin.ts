'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { autenticar, criarSessao, encerrarSessao, exigirSessao } from '@/lib/auth'
import { loginSchema } from '@/lib/schemas'
import { podeTransicionar, type Status } from '@/lib/dominio'

export type EstadoLogin = { mensagem?: string }

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { mensagem: parsed.error.issues[0].message }
  }

  const adminId = await autenticar(parsed.data.usuario, parsed.data.senha)
  if (adminId === null) {
    // Mensagem genérica de propósito: dizer "usuário não existe" entregaria a
    // metade da credencial a quem estivesse tentando adivinhar.
    return { mensagem: 'Usuário ou senha incorretos.' }
  }

  await criarSessao(adminId)
  redirect('/admin')
}

export async function sair(): Promise<void> {
  await encerrarSessao()
  redirect('/admin/login')
}

export type EstadoAcao = { erro?: string; sucesso?: string }

/**
 * Muda o status de uma reserva, validando a transição.
 *
 * A validação de transição impede estados sem sentido — confirmar um pedido
 * já rejeitado, cancelar duas vezes — inclusive quando dois navegadores abertos
 * no painel tentam agir sobre a mesma reserva.
 *
 * Rejeitar e cancelar não têm efeito colateral nenhum: como REJEITADO e
 * CANCELADO não estão em STATUS_QUE_OCUPAM, o horário volta a ficar livre
 * automaticamente para novos pedidos.
 */
export async function mudarStatus(
  _anterior: EstadoAcao,
  formData: FormData,
): Promise<EstadoAcao> {
  try {
    await exigirSessao()
  } catch {
    redirect('/admin/login')
  }

  const id = Number(formData.get('id'))
  const para = String(formData.get('para')) as Status
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  if (!Number.isInteger(id) || id <= 0) return { erro: 'Reserva inválida.' }

  try {
    await prisma.$transaction(async (tx) => {
      const atual = await tx.reserva.findUnique({
        where: { id },
        select: { status: true },
      })
      if (!atual) throw new Error('Reserva não encontrada.')

      const de = atual.status as Status
      if (!podeTransicionar(de, para)) {
        throw new Error(
          `Não é possível mudar de "${de}" para "${para}". ` +
            'A reserva pode ter sido alterada em outra aba — recarregue a página.',
        )
      }

      await tx.reserva.update({
        where: { id },
        data: {
          status: para,
          // A observação é acumulativa no registro atual e fica também no log.
          ...(observacao ? { observacaoAdmin: observacao } : {}),
        },
      })

      await tx.logAcao.create({
        data: { reservaId: id, de, para, observacao },
      })
    })
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha ao atualizar a reserva.' }
  }

  revalidatePath('/admin')
  return { sucesso: 'Reserva atualizada.' }
}
