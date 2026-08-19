import { describe, it, expect } from 'vitest';
import { generateOAuthState, verifyOAuthState } from './state.js';

describe('OAuth State CSRF Protection', () => {
  const secret = 'super-secret-hmac-key-for-unit-testing-32-chars';

  it('generates and verifies a valid state token for a provider', () => {
    const state = generateOAuthState('google', secret);
    expect(state).toBeTypeOf('string');
    expect(state).toContain('.');

    const result = verifyOAuthState(state, 'google', secret);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('is case-insensitive for provider names', () => {
    const state = generateOAuthState('Google', secret);
    const result = verifyOAuthState(state, 'GOOGLE', secret);
    expect(result.valid).toBe(true);
  });

  it('rejects state if expected provider mismatches', () => {
    const state = generateOAuthState('google', secret);
    const result = verifyOAuthState(state, 'github', secret);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Provider mismatch/);
  });

  it('rejects tampered state payload or signature', () => {
    const state = generateOAuthState('google', secret);
    const [payload, sig] = state.split('.');

    // Tampered payload
    const tamperedPayload = Buffer.from('google:attacker:1700000000000').toString('base64url');
    const tamperedState = `${tamperedPayload}.${sig}`;
    expect(verifyOAuthState(tamperedState, 'google', secret).valid).toBe(false);

    // Tampered signature
    const badSigState = `${payload}.${sig?.slice(0, -4)}abcd`;
    expect(verifyOAuthState(badSigState, 'google', secret).valid).toBe(false);
  });

  it('rejects expired state parameter', () => {
    const state = generateOAuthState('google', secret);
    // Negative maxAgeMs or 1ms maxAge after waiting ensures expiration
    const result = verifyOAuthState(state, 'google', secret, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/State parameter expired/);
  });

  it('rejects malformed or empty state strings', () => {
    expect(verifyOAuthState('', 'google', secret).valid).toBe(false);
    expect(verifyOAuthState('no-dot-here', 'google', secret).valid).toBe(false);
    expect(verifyOAuthState('too.many.dots.here', 'google', secret).valid).toBe(false);
    expect(verifyOAuthState('.signatureonly', 'google', secret).valid).toBe(false);
  });
});
