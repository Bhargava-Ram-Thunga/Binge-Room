import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.string().refine((v) => v.startsWith('rediss://'), {
    message: 'REDIS_URL must start with rediss:// (TLS required for Upstash)',
  }),
  JWT_SECRET: z.string().min(32),
  INVITE_TOKEN_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  DAILY_API_KEY: z.string().min(1),
  DAILY_DOMAIN: z.string().min(1),
  PORT_REST: z.coerce.number().default(4000),
  PORT_WS: z.coerce.number().default(4001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const fields = result.error.issues.map((issue) => String(issue.path[0]))
    console.error(`env: missing or invalid: ${fields.join(', ')}`)
    process.exit(1)
  }
  return result.data
}
