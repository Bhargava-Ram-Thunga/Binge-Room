import { describe, it, expect } from 'vitest';
import { generateOAuthState, verifyOAuthState } from './state.js';

describe('OAuth State CSRF Protection', () => {
  const customKey = 'custom-hmac-key-for-unit-testing';

  it('generates and verifies a valid state token for a provider', () => {
    const state = generateOAuthState('google', customKey);
    expect(state).toBeTypeOf('string');
    expect(state).toContain('.');

    const result = verifyOAuthState(state, 'google', customKey);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('is case-insensitive for provider names', () => {
    const state = generateOAuthState('Google', customKey);
    const result = verifyOAuthState(state, 'GOOGLE', customKey);
    expect(result.valid).toBe(true);
  });

  it('rejects state if expected provider mismatches', () => {
    const state = generateOAuthState('google', customKey);
    const result = verifyOAuthState(state, 'github', customKey);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Provider mismatch/);
  });

  it('rejects tampered state payload or signature', () => {
    const state = generateOAuthState('google', customKey);
    const [payload, sig] = state.split('.');

    // Tampered payload
    const tamperedPayload = Buffer.from('google:attacker:1700000000000').toString('base64url');
    const tamperedState = `${tamperedPayload}.${sig}`;
    expect(verifyOAuthState(tamperedState, 'google', customKey).valid).toBe(false);

    // Tampered signature
    const badSigState = `${payload}.${sig?.slice(0, -4)}abcd`;
    expect(verifyOAuthState(badSigState, 'google', customKey).valid).toBe(false);
  });

  it('rejects expired state parameter', () => {
    const state = generateOAuthState('google', customKey);
    const result = verifyOAuthState(state, 'google', customKey, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/State parameter expired/);
  });

  it('rejects malformed or empty state strings', () => {
    expect(verifyOAuthState('', 'google', customKey).valid).toBe(false);
    expect(verifyOAuthState('no-dot-here', 'google', customKey).valid).toBe(false);
    expect(verifyOAuthState('too.many.dots.here', 'google', customKey).valid).toBe(false);
    expect(verifyOAuthState('.signatureonly', 'google', customKey).valid).toBe(false);
  });
});
