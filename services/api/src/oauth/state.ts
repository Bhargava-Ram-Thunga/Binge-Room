import crypto from 'node:crypto';
import { config } from '@huddly/config';

export interface OAuthStatePayload {
  provider: string;
  nonce: string;
  timestamp: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSigningKey(customKey?: string): Buffer {
  const base = customKey || config.JWT_SECRET;
  return crypto.createHash('sha256').update(`huddly-oauth-state-signing-key:${base}`).digest();
}

/**
 * Generate an HMAC-signed state parameter to prevent CSRF attacks
 */
export function generateOAuthState(provider: string, customKey?: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const raw = `${provider.toLowerCase()}:${nonce}:${timestamp}`;
  const key = getSigningKey(customKey);
  const signature = crypto.createHmac('sha256', key).update(raw).digest('base64url');

  const token = Buffer.from(raw).toString('base64url');
  return `${token}.${signature}`;
}

/**
 * Validate an OAuth state parameter against expected provider, signature, and expiration
 */
export function verifyOAuthState(
  state: string,
  expectedProvider: string,
  customKey?: string,
  maxAgeMs = STATE_MAX_AGE_MS,
): { valid: boolean; error?: string } {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'State parameter missing' };
  }

  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, error: 'Malformed state parameter' };
  }

  const [encodedPayload, signature] = parts;
  let raw: string;
  try {
    raw = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return { valid: false, error: 'Invalid state encoding' };
  }

  const key = getSigningKey(customKey);
  const expectedSignature = crypto.createHmac('sha256', key).update(raw).digest('base64url');

  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'State signature mismatch' };
  }

  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );

  if (!signaturesMatch) {
    return { valid: false, error: 'State signature invalid' };
  }

  const segments = raw.split(':');
  if (segments.length !== 3) {
    return { valid: false, error: 'Invalid state payload structure' };
  }

  const [provider, , timestampStr] = segments;
  if (provider?.toLowerCase() !== expectedProvider.toLowerCase()) {
    return {
      valid: false,
      error: `Provider mismatch (expected ${expectedProvider}, got ${provider})`,
    };
  }

  const timestamp = parseInt(timestampStr || '0', 10);
  if (isNaN(timestamp) || Date.now() - timestamp > maxAgeMs || timestamp > Date.now() + 60000) {
    return { valid: false, error: 'State parameter expired' };
  }

  return { valid: true };
}
