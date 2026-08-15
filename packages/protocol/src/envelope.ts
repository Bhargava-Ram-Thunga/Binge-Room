/**
 * Huddly realtime protocol — event envelope (spec §36).
 *
 * Every realtime event on the control/data plane is wrapped in this envelope so
 * that clients (extension, web, mobile) can validate, order, and authorize events
 * against a single versioned contract.
 */

export const PROTOCOL_VERSION = 1 as const;

/** Events the MVP control plane carries. Extended per phase. */
export const EVENT_TYPES = [
  // room lifecycle
  'ROOM_JOINED',
  'ROOM_LEFT',
  'ROOM_CLOSED',
  // presence
  'PRESENCE_UPDATED',
  // playback (Phase 5)
  'PLAYBACK_PLAY',
  'PLAYBACK_PAUSE',
  'PLAYBACK_SEEK',
  'PLAYBACK_RATE_CHANGE',
  'PLAYBACK_MEDIA_CHANGED',
  // chat (Phase 7)
  'CHAT_MESSAGE_CREATED',
  'CHAT_MESSAGE_DELETED',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventEnvelope<TPayload = unknown> {
  /** Unique id for this event; used for de-duplication on the client. */
  eventId: string;
  eventType: EventType;
  roomId: string;
  /** User who caused the event. Null for server-originated events. */
  actorId: string | null;
  /** Server-assigned, monotonically increasing per room. Orders all state. */
  revision: number;
  /** Authoritative server clock in epoch milliseconds. Never a device clock. */
  serverTimestamp: number;
  protocolVersion: number;
  payload: TPayload;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: readonly string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates an untrusted inbound message against the envelope contract.
 *
 * This is a structural gate only — it never implies the actor is *authorized*
 * to perform the event. Authorization is always a separate server-side check
 * (spec §46: never trust a client that claims to be host).
 */
export function validateEnvelope(input: unknown): ValidationResult<EventEnvelope> {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['envelope must be an object'] };
  }

  const { eventId, eventType, roomId, actorId, revision, serverTimestamp, protocolVersion } = input;

  if (typeof eventId !== 'string' || !UUID_RE.test(eventId)) {
    errors.push('eventId must be a UUID string');
  }
  if (typeof eventType !== 'string' || !(EVENT_TYPES as readonly string[]).includes(eventType)) {
    errors.push(`eventType must be one of: ${EVENT_TYPES.join(', ')}`);
  }
  if (typeof roomId !== 'string' || !UUID_RE.test(roomId)) {
    errors.push('roomId must be a UUID string');
  }
  if (actorId !== null && (typeof actorId !== 'string' || !UUID_RE.test(actorId))) {
    errors.push('actorId must be a UUID string or null');
  }
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    errors.push('revision must be a non-negative integer');
  }
  if (typeof serverTimestamp !== 'number' || !Number.isFinite(serverTimestamp)) {
    errors.push('serverTimestamp must be a finite number');
  }
  if (protocolVersion !== PROTOCOL_VERSION) {
    errors.push(`protocolVersion must be ${PROTOCOL_VERSION}`);
  }
  if (!('payload' in input)) {
    errors.push('payload is required');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: input as unknown as EventEnvelope };
}

/**
 * Decides whether an inbound event should be applied to local state.
 *
 * Clients never decide final room state (spec §24) — they only accept events
 * that advance the server-assigned revision, discarding stale or replayed ones.
 */
export function shouldApply(currentRevision: number, incoming: EventEnvelope): boolean {
  return incoming.revision > currentRevision;
}
