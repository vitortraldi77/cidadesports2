import { STATUS, type Status } from '@/lib/dominio'

/**
 * Cores por status. A escolha segue o significado, não a estética: verde para
 * o que está resolvido, âmbar para o que exige ação do Vitor, cinza para o que
 * já saiu do fluxo.
 *
 * De propósito, nenhum desses tons é o vermelho de marca — esse fica reservado
 * para os botões de ação. Se "confirmado" usasse a cor da marca, a etiqueta de
 * maior sucesso do fluxo ficaria visualmente idêntica a um alerta.
 */
const ESTILO: Record<Status, string> = {
  PENDENTE: 'bg-alerta-fraca text-alerta ring-1 ring-alerta/20',
  APROVADO: 'bg-info-fraca text-info ring-1 ring-info/20',
  CONFIRMADO: 'bg-sucesso-fraca text-sucesso-forte ring-1 ring-sucesso/20',
  REJEITADO: 'bg-perigo-fraca text-perigo ring-1 ring-perigo/20',
  CANCELADO: 'bg-fundo text-tinta-suave ring-1 ring-borda-forte',
}

const PONTO: Record<Status, string> = {
  PENDENTE: 'bg-alerta',
  APROVADO: 'bg-info',
  CONFIRMADO: 'bg-sucesso',
  REJEITADO: 'bg-perigo',
  CANCELADO: 'bg-tinta-fraca',
}

export function Etiqueta({ status }: { status: Status }) {
  return (
    <span className={`etiqueta ${ESTILO[status]}`}>
      <span className={`size-1.5 rounded-full ${PONTO[status]}`} aria-hidden />
      {STATUS[status]}
    </span>
  )
}
