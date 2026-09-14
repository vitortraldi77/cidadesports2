import 'server-only'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

const COOKIE = 'cs_sessao'
const DURACAO_HORAS = 12

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres). ' +
        'Gere um com: openssl rand -base64 32',
    )
  }
  return new TextEncoder().encode(s)
}

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}

/**
 * Autentica o admin.
 *
 * Quando o usuário não existe, ainda assim comparamos contra um hash
 * descartável. Sem isso, a resposta voltaria instantaneamente para usuário
 * inexistente e após ~100ms para usuário existente com senha errada — uma
 * diferença de tempo que revela quais usuários existem.
 */
const HASH_FALSO = '$2b$12$z9NY.5piONGWcO6bfLUn5Ol3TtOtJE.kHxuZyG31k0aOGUJU8Nfb6'

export async function autenticar(usuario: string, senha: string): Promise<number | null> {
  const admin = await prisma.adminUser.findUnique({ where: { usuario } })
  const confere = await bcrypt.compare(senha, admin?.senhaHash ?? HASH_FALSO)
  if (!admin || !confere) return null
  return admin.id
}

export async function criarSessao(adminId: number): Promise<void> {
  const expira = new Date(Date.now() + DURACAO_HORAS * 3600 * 1000)

  const token = await new SignJWT({ sub: String(adminId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expira)
    .sign(segredo())

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true, // inacessível ao JavaScript da página
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // barra o cookie em requisições cross-site (anti-CSRF)
    path: '/',
    expires: expira,
  })
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

/** Devolve o id do admin logado, ou null. */
export async function sessaoAtual(): Promise<number | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, segredo())
    return payload.sub ? Number(payload.sub) : null
  } catch {
    // Token expirado, adulterado ou assinado com outro segredo.
    return null
  }
}

export async function exigirSessao(): Promise<number> {
  const id = await sessaoAtual()
  if (id === null) throw new Error('NAO_AUTENTICADO')
  return id
}
