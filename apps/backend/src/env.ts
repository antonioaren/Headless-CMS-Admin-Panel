import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173')
})

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/cms',
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN
})
