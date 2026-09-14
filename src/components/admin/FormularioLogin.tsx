'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar, type EstadoLogin } from '@/app/actions/admin'

export function FormularioLogin() {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {})

  return (
    <form action={acao} className="space-y-4">
      {estado.mensagem && (
        <p
          role="alert"
          className="rounded-lg border border-perigo/25 bg-perigo-fraca px-3 py-2 text-sm font-medium text-perigo"
        >
          {estado.mensagem}
        </p>
      )}

      <div>
        <label htmlFor="usuario" className="rotulo">
          Usuário
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className="campo"
        />
      </div>

      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </div>

      <Botao />
    </form>
  )
}

function Botao() {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} className="botao-primario w-full">
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  )
}
