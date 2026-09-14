import { REGRAS } from '../dominio'
import { duracaoEmMinutos } from '../datas'

/** Duração máxima de 2 horas. */
export function validarDuracao(
  horaInicio: string,
  horaFim: string,
): { ok: true } | { ok: false; mensagem: string } {
  const minutos = duracaoEmMinutos(horaInicio, horaFim)

  if (minutos <= 0) {
    return { ok: false, mensagem: 'O horário de término deve ser depois do horário de início.' }
  }

  if (minutos > REGRAS.DURACAO_MAXIMA_MINUTOS) {
    const horas = (REGRAS.DURACAO_MAXIMA_MINUTOS / 60).toString().replace('.', ',')
    return {
      ok: false,
      mensagem:
        `A reserva pode ter no máximo ${horas} horas. ` +
        `O período informado tem ${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}.`,
    }
  }

  return { ok: true }
}
