import { describe, it, expect } from 'vitest';
import { generateOAuthState, verifyOAuthState } from './state.js';

describe('OAuth State CSRF Protection', () => {
  const secretKey = 'super-secret-key-for-state-signing-32ch';

  it('generates and verifies a valid state token for a provider', () => {
    const state = generateOAuthState('google', secretKey);
    expect(state).toBeTypeOf('string');
    expect(state).toContain('.');

    const result = verifyOAuthState(state, 'google', secretKey);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('is case-insensitive for provider names', () => {
    const state = generateOAuthState('Google', secretKey);
    const result = verifyOAuthState(state, 'GOOGLE', secretKey);
    expect(result.valid).toBe(true);
  });

  it('rejects state if expected provider mismatches', () => {
    const state = generateOAuthState('google', secretKey);
    const result = verifyOAuthState(state, 'github', secretKey);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Provider mismatch/);
  });

  it('rejects tampered state payload or signature', () => {
    const state = generateOAuthState('google', secretKey);
    const dotIndex = state.lastIndexOf('.');
    const encodedPayload = state.slice(0, dotIndex);
    const signature = state.slice(dotIndex + 1);

    // Tampered payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ p: 'google', n: 'attacker', t: 1700000000000 }),
    ).toString('base64url');
    const tamperedState = `${tamperedPayload}.${signature}`;
    expect(verifyOAuthState(tamperedState, 'google', secretKey).valid).toBe(false);

    // Tampered signature
    const badSigState = `${encodedPayload}.${signature.slice(0, -4)}abcd`;
    expect(verifyOAuthState(badSigState, 'google', secretKey).valid).toBe(false);
  });

  it('rejects expired state parameter', () => {
    const state = generateOAuthState('google', secretKey);
    const result = verifyOAuthState(state, 'google', secretKey, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/State parameter expired/);
  });

  it('rejects malformed or empty state strings', () => {
    expect(verifyOAuthState('', 'google', secretKey).valid).toBe(false);
    expect(verifyOAuthState('no-dot-here', 'google', secretKey).valid).toBe(false);
    expect(verifyOAuthState('.signatureonly', 'google', secretKey).valid).toBe(false);
  });
});
