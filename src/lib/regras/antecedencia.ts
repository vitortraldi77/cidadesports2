import { REGRAS } from '../dominio'
import { formatarData, hoje, somaDiasUteis } from '../datas'

/**
 * Antecedência mínima de 3 dias úteis (seg–sex) a partir da data de envio.
 *
 * Feriados NÃO são considerados — não existe calendário de feriados no
 * sistema. Na prática isso significa que numa semana com feriado a
 * antecedência real fica menor que 3 dias de expediente. Se isso vier a
 * incomodar, o ponto de mudança é `ehDiaUtil` em lib/datas.ts.
 */
export function primeiraDataValida(referencia = hoje()): string {
  return somaDiasUteis(referencia, REGRAS.ANTECEDENCIA_DIAS_UTEIS)
}

export function validarAntecedencia(
  data: string,
  referencia = hoje(),
): { ok: true } | { ok: false; mensagem: string } {
  const minima = primeiraDataValida(referencia)

  // Comparação de strings "YYYY-MM-DD" é comparação cronológica.
  if (data < minima) {
    return {
      ok: false,
      mensagem:
        `A reserva precisa ser solicitada com no mínimo ${REGRAS.ANTECEDENCIA_DIAS_UTEIS} ` +
        `dias úteis de antecedência. A data mais próxima disponível é ${formatarData(minima)}.`,
    }
  }

  return { ok: true }
}
