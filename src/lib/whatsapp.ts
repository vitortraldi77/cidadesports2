import { ESPACOS, protocolo, type Espaco, type Status } from './dominio'
import { formatarDataPorExtenso, formatarIntervalo } from './datas'

type Reserva = {
  id: number
  nomeSolicitante: string
  telefone: string
  espaco: string
  data: string
  horaInicio: string
  horaFim: string
}

/** Primeiro nome, para a mensagem soar como uma pessoa falando. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0]
}

/**
 * Monta o link wa.me com a mensagem já escrita.
 *
 * O texto é apenas um rascunho: o WhatsApp abre com ele preenchido na caixa de
 * digitação e o Vitor edita ou envia. Nada é enviado automaticamente pelo
 * sistema — o contato continua sendo pessoal, como no processo atual.
 */
export function linkWhatsApp(r: Reserva, situacao: Status): string {
  // O Brasil é +55; o telefone é guardado só com dígitos e DDD.
  const numero = `55${r.telefone.replace(/\D/g, '')}`
  const espaco = ESPACOS[r.espaco as Espaco] ?? r.espaco
  const quando = `${formatarDataPorExtenso(r.data)}, das ${formatarIntervalo(r.horaInicio, r.horaFim)}`
  const ola = `Olá, ${primeiroNome(r.nomeSolicitante)}! Aqui é do Cidade Sports (Igreja da Cidade).`

  // "Quadra" é feminino e "campo" é masculino, então o nome do espaço entra
  // sempre depois de dois-pontos, nunca precedido de artigo — assim a frase
  // fica correta para os três espaços sem carregar gênero em cada um.
  const reserva = `${espaco} — ${quando}`

  const corpo: Record<Status, string> = {
    PENDENTE:
      `${ola}\n\n` +
      `Recebemos o seu pedido de reserva ${protocolo(r.id)}:\n${reserva}\n\n` +
      `Estamos avaliando e retornamos em breve.`,

    APROVADO:
      `${ola}\n\n` +
      `Boa notícia: o seu pedido ${protocolo(r.id)} foi APROVADO.\n${reserva}\n\n` +
      `Podemos confirmar essa data e esse horário com você?`,

    CONFIRMADO:
      `${ola}\n\n` +
      `Sua reserva ${protocolo(r.id)} está CONFIRMADA.\n${reserva}\n\n` +
      `Pedimos que chegue com alguns minutos de antecedência e que o espaço seja ` +
      `devolvido limpo ao final. Qualquer imprevisto, avise por aqui.`,

    REJEITADO:
      `${ola}\n\n` +
      `Sobre o seu pedido ${protocolo(r.id)}:\n${reserva}\n\n` +
      `Infelizmente não conseguiremos atender dessa vez. ` +
      `Se quiser, podemos verificar outra data ou outro horário.`,

    CANCELADO:
      `${ola}\n\n` +
      `Sua reserva ${protocolo(r.id)} foi CANCELADA.\n${reserva}\n\n` +
      `Se precisar remarcar, é só fazer um novo pedido pelo formulário.`,
  }

  return `https://wa.me/${numero}?text=${encodeURIComponent(corpo[situacao])}`
}
