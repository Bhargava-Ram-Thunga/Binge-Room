import crypto from 'node:crypto';
import { config } from '@huddly/config';

export interface OAuthStatePayload {
  p: string; // provider
  n: string; // nonce
  t: number; // timestamp
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate an HMAC-signed CSRF state token for OAuth flows
 */
export function generateOAuthState(provider: string, signingKey = config.JWT_SECRET): string {
  const payload: OAuthStatePayload = {
    p: provider.toLowerCase(),
    n: crypto.randomBytes(16).toString('hex'),
    t: Date.now(),
  };

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadStr, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * Validate an OAuth state parameter against expected provider, signature, and expiration
 */
export function verifyOAuthState(
  stateToken: string,
  expectedProvider: string,
  signingKey = config.JWT_SECRET,
  maxAgeMs = STATE_MAX_AGE_MS,
): { valid: boolean; error?: string } {
  if (!stateToken || typeof stateToken !== 'string') {
    return { valid: false, error: 'State parameter missing' };
  }

  const dotIndex = stateToken.lastIndexOf('.');
  if (dotIndex === -1) {
    return { valid: false, error: 'Malformed state parameter' };
  }

  const encodedPayload = stateToken.slice(0, dotIndex);
  const signature = stateToken.slice(dotIndex + 1);

  if (!encodedPayload || !signature) {
    return { valid: false, error: 'Malformed state parameter' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(encodedPayload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'State signature mismatch' };
  }

  const isValidSignature = crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );

  if (!isValidSignature) {
    return { valid: false, error: 'State signature invalid' };
  }

  let payload: OAuthStatePayload;
  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr) as OAuthStatePayload;
  } catch {
    return { valid: false, error: 'Invalid state payload encoding' };
  }

  if (payload.p?.toLowerCase() !== expectedProvider.toLowerCase()) {
    return {
      valid: false,
      error: `Provider mismatch (expected ${expectedProvider}, got ${payload.p})`,
    };
  }

  if (
    typeof payload.t !== 'number' ||
    Date.now() - payload.t > maxAgeMs ||
    payload.t > Date.now() + 60000
  ) {
    return { valid: false, error: 'State parameter expired' };
  }

  return { valid: true };
}
