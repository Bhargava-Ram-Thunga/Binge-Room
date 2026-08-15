import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, shouldApply, validateEnvelope, type EventEnvelope } from './envelope.js';

const validEnvelope = (overrides: Record<string, unknown> = {}) => ({
  eventId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  eventType: 'PLAYBACK_PLAY',
  roomId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  actorId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  revision: 42,
  serverTimestamp: 1786780000000,
  protocolVersion: PROTOCOL_VERSION,
  payload: { position: 105.32 },
  ...overrides,
});

describe('validateEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    const result = validateEnvelope(validEnvelope());
    expect(result.ok).toBe(true);
  });

  it('accepts a null actorId for server-originated events', () => {
    const result = validateEnvelope(validEnvelope({ actorId: null, eventType: 'ROOM_CLOSED' }));
    expect(result.ok).toBe(true);
  });

  it('accepts revision zero as the initial room state', () => {
    const result = validateEnvelope(validEnvelope({ revision: 0 }));
    expect(result.ok).toBe(true);
  });

  it.each([
    ['non-object input', 'not-an-object'],
    ['null input', null],
    ['array input', []],
  ])('rejects %s', (_label, input) => {
    const result = validateEnvelope(input);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown event type', () => {
    const result = validateEnvelope(validEnvelope({ eventType: 'DROP_DATABASE' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/eventType/);
  });

  it('rejects a malformed eventId', () => {
    const result = validateEnvelope(validEnvelope({ eventId: '123' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/eventId/);
  });

  it('rejects a negative or fractional revision', () => {
    expect(validateEnvelope(validEnvelope({ revision: -1 })).ok).toBe(false);
    expect(validateEnvelope(validEnvelope({ revision: 1.5 })).ok).toBe(false);
  });

  it('rejects a mismatched protocol version', () => {
    const result = validateEnvelope(validEnvelope({ protocolVersion: 999 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/protocolVersion/);
  });

  it('rejects an envelope with no payload key', () => {
    const { payload: _payload, ...withoutPayload } = validEnvelope();
    const result = validateEnvelope(withoutPayload);
    expect(result.ok).toBe(false);
  });

  it('reports every problem at once rather than failing fast', () => {
    const result = validateEnvelope({ eventId: 'x', eventType: 'NOPE', roomId: 'y' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe('shouldApply', () => {
  const event = (revision: number) =>
    ({ ...validEnvelope({ revision }) }) as unknown as EventEnvelope;

  it('applies an event that advances the revision', () => {
    expect(shouldApply(41, event(42))).toBe(true);
  });

  it('discards a replayed event at the same revision', () => {
    expect(shouldApply(42, event(42))).toBe(false);
  });

  it('discards an out-of-order event from the past', () => {
    expect(shouldApply(42, event(7))).toBe(false);
  });
});
