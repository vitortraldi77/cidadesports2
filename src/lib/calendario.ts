import { paraMinutos } from './datas'

/**
 * Distribuição de reservas simultâneas em faixas lado a lado.
 *
 * O calendário mostra os três espaços numa coluna só por dia, então duas
 * reservas podem ocupar o mesmo horário sem nenhum conflito — vôlei às 19h e
 * campo às 19h são perfeitamente válidos. Empilhadas, uma esconderia a outra;
 * lado a lado, as duas aparecem.
 *
 * O algoritmo é o clássico de layout de agenda:
 *
 *  1. Ordena por início.
 *  2. Cada reserva entra na primeira faixa cuja última reserva já terminou.
 *  3. Reservas que se sobrepõem em cadeia formam um grupo, e a largura de cada
 *     bloco é 1/(faixas do grupo).
 *
 * O passo 3 é o que evita o resultado feio: se o dia tem um único par
 * sobreposto pela manhã, só aquele par fica com meia largura — as reservas da
 * tarde continuam ocupando a coluna inteira.
 */

export type Faixa<T> = {
  item: T
  /** Minutos desde a meia-noite. */
  inicio: number
  fim: number
  /** Índice da faixa dentro do grupo (0 é a mais à esquerda). */
  faixa: number
  /** Quantas faixas o grupo tem, para calcular a largura. */
  faixas: number
}

type ComHorario = { horaInicio: string; horaFim: string }

export function distribuirEmFaixas<T extends ComHorario>(itens: T[]): Faixa<T>[] {
  const ordenados = [...itens].sort((a, b) => {
    const d = paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio)
    // Empate no início: a mais longa primeiro, para o bloco maior ficar à
    // esquerda e a leitura seguir a ordem natural.
    return d !== 0 ? d : paraMinutos(b.horaFim) - paraMinutos(a.horaFim)
  })

  const resultado: Faixa<T>[] = []

  // Grupo corrente de reservas que se sobrepõem em cadeia.
  let grupo: Faixa<T>[] = []
  // Fim da última reserva de cada faixa do grupo corrente.
  let fimPorFaixa: number[] = []

  function fecharGrupo() {
    for (const f of grupo) f.faixas = fimPorFaixa.length
    grupo = []
    fimPorFaixa = []
  }

  for (const item of ordenados) {
    const inicio = paraMinutos(item.horaInicio)
    const fim = paraMinutos(item.horaFim)

    // Se esta reserva começa depois de todas as do grupo terminarem, o grupo
    // acabou: nada mais se sobrepõe a ele.
    if (grupo.length > 0 && inicio >= Math.max(...fimPorFaixa)) {
      fecharGrupo()
    }

    // Primeira faixa livre neste horário.
    let faixa = fimPorFaixa.findIndex((f) => f <= inicio)
    if (faixa === -1) {
      faixa = fimPorFaixa.length
      fimPorFaixa.push(fim)
    } else {
      fimPorFaixa[faixa] = fim
    }

    const bloco: Faixa<T> = { item, inicio, fim, faixa, faixas: 1 }
    grupo.push(bloco)
    resultado.push(bloco)
  }

  fecharGrupo()

  return resultado
}

/**
 * Faixa de horas que a grade precisa mostrar.
 *
 * Parte de um horário comercial padrão e só expande se houver reserva fora
 * dele — assim uma semana vazia não vira uma grade de 24 horas, e uma reserva
 * das 6h da manhã não fica cortada.
 */
export function faixaDeHoras(
  itens: ComHorario[],
  base = { de: 7, ate: 23 },
): { de: number; ate: number } {
  let de = base.de
  let ate = base.ate

  for (const i of itens) {
    de = Math.min(de, Math.floor(paraMinutos(i.horaInicio) / 60))
    // Arredonda o fim para cima: uma reserva até 22:30 precisa da linha das 23h.
    ate = Math.max(ate, Math.ceil(paraMinutos(i.horaFim) / 60))
  }

  return { de, ate }
}
