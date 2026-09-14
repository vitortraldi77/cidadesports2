import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Client do Prisma como singleton.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; sem guardar
 * a instância no globalThis, cada recarga abriria uma nova conexão até estourar
 * o limite do banco.
 *
 * Banco: Postgres (Neon, via Vercel Marketplace). `DATABASE_URL` deve ser a
 * connection string com pooler (pgbouncer) — é a que o Vercel injeta e a que
 * aguenta várias funções serverless abrindo conexão ao mesmo tempo.
 */

const criarClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof criarClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? criarClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
