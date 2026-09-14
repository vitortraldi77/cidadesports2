import 'dotenv/config' // o Prisma 7 não carrega .env sozinho na CLI
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // No Prisma 7 a URL de conexão saiu do schema.prisma e vive aqui.
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
