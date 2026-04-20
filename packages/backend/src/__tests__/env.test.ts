import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseEnv } from '../env'

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:pass@host:6543/db?pgbouncer=true',
  DIRECT_URL: 'postgresql://user:pass@host:5432/db',
  REDIS_URL: 'rediss://default:secret@region.upstash.io:6380',
  JWT_SECRET: 'a'.repeat(32),
  INVITE_TOKEN_SECRET: 'b'.repeat(32),
  SUPABASE_URL: 'https://abcdef.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiJ9.anon',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.service',
  SUPABASE_JWT_SECRET: 'supabase-jwt-secret-value',
  DAILY_API_KEY: 'daily-api-key-value',
  DAILY_DOMAIN: 'bingeroom.daily.co',
  PORT_REST: '4000',
  PORT_WS: '4001',
  NODE_ENV: 'test',
}

describe('parseEnv', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`EXIT:${_code}`)
    })
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    exitSpy.mockRestore()
    consoleSpy.mockRestore()
  })

  describe('happy path', () => {
    it('returns typed env object when all required fields are present and valid', () => {
      const env = parseEnv(validEnv)
      expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL)
      expect(env.REDIS_URL).toBe(validEnv.REDIS_URL)
      expect(env.JWT_SECRET).toBe(validEnv.JWT_SECRET)
      expect(env.PORT_REST).toBe(4000)
    })
  })

  describe('required field validation', () => {
    it('calls process.exit(1) and logs "DATABASE_URL" when DATABASE_URL is missing', () => {
      expect(() => parseEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'))
    })

    it('calls process.exit(1) and logs "DIRECT_URL" when DIRECT_URL is missing', () => {
      expect(() => parseEnv({ ...validEnv, DIRECT_URL: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DIRECT_URL'))
    })

    it('calls process.exit(1) and logs "REDIS_URL" when REDIS_URL is missing', () => {
      expect(() => parseEnv({ ...validEnv, REDIS_URL: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL'))
    })

    it('calls process.exit(1) and logs "REDIS_URL" when REDIS_URL starts with redis:// instead of rediss://', () => {
      expect(() =>
        parseEnv({ ...validEnv, REDIS_URL: 'redis://default:secret@host:6379' }),
      ).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL'))
    })

    it('calls process.exit(1) and logs "JWT_SECRET" when JWT_SECRET is missing', () => {
      expect(() => parseEnv({ ...validEnv, JWT_SECRET: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'))
    })

    it('calls process.exit(1) and logs "JWT_SECRET" when JWT_SECRET is shorter than 32 characters', () => {
      expect(() => parseEnv({ ...validEnv, JWT_SECRET: 'tooshort' })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'))
    })

    it('calls process.exit(1) and logs "INVITE_TOKEN_SECRET" when INVITE_TOKEN_SECRET is missing', () => {
      expect(() => parseEnv({ ...validEnv, INVITE_TOKEN_SECRET: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('INVITE_TOKEN_SECRET'))
    })

    it('calls process.exit(1) and logs "INVITE_TOKEN_SECRET" when INVITE_TOKEN_SECRET is shorter than 32 characters', () => {
      expect(() => parseEnv({ ...validEnv, INVITE_TOKEN_SECRET: 'tooshort' })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('INVITE_TOKEN_SECRET'))
    })

    it('calls process.exit(1) and logs "SUPABASE_URL" when SUPABASE_URL is missing', () => {
      expect(() => parseEnv({ ...validEnv, SUPABASE_URL: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_URL'))
    })

    it('calls process.exit(1) and logs "SUPABASE_SERVICE_ROLE_KEY" when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      expect(() => parseEnv({ ...validEnv, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow('EXIT:1')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY'))
    })
  })

  describe('multi-field failure', () => {
    it('logs ALL missing field names when multiple fields are absent simultaneously', () => {
      expect(() =>
        parseEnv({
          ...validEnv,
          DATABASE_URL: undefined,
          JWT_SECRET: undefined,
          INVITE_TOKEN_SECRET: undefined,
        }),
      ).toThrow('EXIT:1')
      const errorMessage = (consoleSpy.mock.calls[0] as string[])[0]
      expect(errorMessage).toContain('DATABASE_URL')
      expect(errorMessage).toContain('JWT_SECRET')
      expect(errorMessage).toContain('INVITE_TOKEN_SECRET')
    })
  })

  describe('optional fields with defaults', () => {
    it('defaults PORT_REST to 4000 when PORT_REST is not set', () => {
      const env = parseEnv({ ...validEnv, PORT_REST: undefined })
      expect(env.PORT_REST).toBe(4000)
    })

    it('defaults NODE_ENV to "development" when NODE_ENV is not set', () => {
      const env = parseEnv({ ...validEnv, NODE_ENV: undefined })
      expect(env.NODE_ENV).toBe('development')
    })
  })
})
