import { describe, it, expect } from 'vitest';
import { parseConfig } from './index.js';

describe('@huddly/config', () => {
  it('loads valid default development configuration', () => {
    const config = parseConfig({});
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.WS_PORT).toBe(3001);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.REDIS_PUBSUB_URL).toBe('redis://localhost:6379/0');
    expect(config.REDIS_STATE_URL).toBe('redis://localhost:6379/1');
    expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(Array.isArray(config.CORS_ORIGINS)).toBe(true);
  });

  it('correctly parses custom environment variables', () => {
    const custom = parseConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      WS_PORT: '8081',
      DATABASE_URL: 'postgresql://user:pass@prod-db:5432/huddly_prod',
      REDIS_PUBSUB_URL: 'redis://redis-cluster:6379/0',
      REDIS_STATE_URL: 'redis://redis-cluster:6379/1',
      JWT_SECRET: 'production_super_secure_secret_key_exceeding_32_characters',
      CORS_ORIGINS: 'https://huddly.app, https://app.huddly.app',
      LIVEKIT_URL: 'https://livekit.huddly.app',
      LIVEKIT_API_KEY: 'API_KEY_123',
      LIVEKIT_API_SECRET: 'API_SECRET_456',
    });

    expect(custom.NODE_ENV).toBe('production');
    expect(custom.PORT).toBe(8080);
    expect(custom.WS_PORT).toBe(8081);
    expect(custom.DATABASE_URL).toBe('postgresql://user:pass@prod-db:5432/huddly_prod');
    expect(custom.CORS_ORIGINS).toEqual(['https://huddly.app', 'https://app.huddly.app']);
    expect(custom.LIVEKIT_URL).toBe('https://livekit.huddly.app');
  });

  it('rejects short JWT_SECRET (< 32 chars)', () => {
    expect(() =>
      parseConfig({
        JWT_SECRET: 'too_short',
      }),
    ).toThrowError(/JWT_SECRET must be at least 32 characters/);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() =>
      parseConfig({
        NODE_ENV: 'invalid_env' as unknown as 'development',
      }),
    ).toThrowError(/Environment validation failed/);
  });

  it('rejects invalid URL for DATABASE_URL', () => {
    expect(() =>
      parseConfig({
        DATABASE_URL: 'not-a-valid-url',
      }),
    ).toThrowError(/DATABASE_URL/);
  });
});
