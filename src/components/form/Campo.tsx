'use client'

import { AlertCircle } from 'lucide-react'

type Props = {
  id: string
  rotulo: string
  ajuda?: string
  erros?: string[]
  obrigatorio?: boolean
  children: (props: { id: string; invalido: boolean; descritoPor?: string }) => React.ReactNode
}

/**
 * Envelope de campo: rótulo, texto de ajuda e erro, com os vínculos de
 * acessibilidade (aria-invalid / aria-describedby) já ligados — que é
 * justamente a parte que se esquece quando cada campo é montado à mão.
 */
export function Campo({ id, rotulo, ajuda, erros, obrigatorio, children }: Props) {
  const invalido = Boolean(erros?.length)
  const idAjuda = ajuda ? `${id}-ajuda` : undefined
  const idErro = invalido ? `${id}-erro` : undefined
  const descritoPor = [idAjuda, idErro].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {rotulo}
        {obrigatorio && (
          <span className="ml-0.5 text-perigo" aria-hidden>
            *
          </span>
        )}
      </label>

      {children({ id, invalido, descritoPor })}

      {ajuda && (
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
      )}

      {invalido && (
        <p id={idErro} className="erro" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{erros!.join(' ')}</span>
        </p>
      )}
    </div>
  )
}
