import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * Client do Prisma como singleton.
 *
 * Em desenvolvimento o Next recarrega os módulos a cada alteração; sem guardar
 * a instância no globalThis, cada recarga abriria uma nova conexão até estourar
 * o limite do banco.
 *
 * No Prisma 7 a conexão é feita por um driver adapter — trocar de SQLite para
 * Postgres significa trocar este adapter por PrismaPg e o provider no
 * schema.prisma, sem tocar em nenhuma query.
 */

const criarClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  })

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof criarClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? criarClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
