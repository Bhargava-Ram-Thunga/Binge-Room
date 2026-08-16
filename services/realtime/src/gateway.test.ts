import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { buildGatewayApp } from './gateway.js';
import { PROTOCOL_VERSION, type EventEnvelope } from '@huddly/protocol';
import type { Redis } from 'ioredis';
import type { AddressInfo } from 'net';

// In-memory Redis Mock for isolated testing
class MockRedis extends EventEmitter {
  store = new Map<string, string>();
  channels = new Set<string>();

  async getdel(key: string): Promise<string | null> {
    const val = this.store.get(key) || null;
    this.store.delete(key);
    return val;
  }

  async setex(key: string, _ttl: number, val: string): Promise<'OK'> {
    this.store.set(key, val);
    return 'OK';
  }

  async publish(channel: string, message: string): Promise<number> {
    this.emit('message', channel, message);
    return 1;
  }

  async subscribe(channel: string): Promise<number> {
    this.channels.add(channel);
    return 1;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.channels.delete(channel);
    return 1;
  }

  duplicate() {
    return this;
  }

  async quit() {
    return 'OK';
  }
}

describe('Realtime Sync Gateway (@huddly/realtime)', () => {
  let app: FastifyInstance;
  let mockRedisState: MockRedis;
  let mockRedisPubSub: MockRedis;
  let serverPort: number;

  beforeAll(async () => {
    mockRedisState = new MockRedis();
    mockRedisPubSub = new MockRedis();

    app = await buildGatewayApp({
      redisState: mockRedisState as unknown as Redis,
      redisPubSub: mockRedisPubSub as unknown as Redis,
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as AddressInfo;
    serverPort = address.port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects connection if no ticket is provided', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const result = await closePromise;
    expect(result.code).toBe(4401);
  });

  it('accepts connection with valid ticket and receives initial snapshot', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    mockRedisState.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId: 'member-1',
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    const messagePromise = new Promise<EventEnvelope<'ROOM_STATE_SNAPSHOT'>>((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    const msg = await messagePromise;
    expect(msg.eventType).toBe('ROOM_STATE_SNAPSHOT');
    expect(msg.roomId).toBe(roomId);
    expect(msg.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(msg.payload.room.roomId).toBe(roomId);

    ws.close();
  });

  it('handles CLOCK_SYNC_PROBE and returns CLOCK_SYNC_RESPONSE', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    mockRedisState.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId: 'member-1',
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore initial snapshot
    });

    const probePromise = new Promise<{ type: string; t1: number; t2: number; t3: number }>(
      (resolve) => {
        ws.on('message', (data) => {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'CLOCK_SYNC_RESPONSE') resolve(parsed);
        });
      },
    );

    const clientT1 = Date.now();
    ws.send(JSON.stringify({ type: 'CLOCK_SYNC_PROBE', t1: clientT1 }));

    const res = await probePromise;
    expect(res.type).toBe('CLOCK_SYNC_RESPONSE');
    expect(res.t1).toBe(clientT1);
    expect(typeof res.t2).toBe('number');
    expect(typeof res.t3).toBe('number');

    ws.close();
  });

  it('broadcasts PLAYBACK_PLAY when sent by HOST', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    mockRedisState.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId: 'member-1',
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore snapshot
    });

    const eventPromise = new Promise<EventEnvelope<'PLAYBACK_PLAY'>>((resolve) => {
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.eventType === 'PLAYBACK_PLAY') resolve(parsed);
      });
    });

    const playEvent = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: randomUUID(),
      eventType: 'PLAYBACK_PLAY',
      roomId,
      actorId: userId,
      revision: 1,
      serverTimestamp: Date.now(),
      payload: {
        mediaId: 'video-123',
        position: 45.5,
        playbackRate: 1.0,
      },
    };

    ws.send(JSON.stringify(playEvent));

    const received = await eventPromise;
    expect(received.eventType).toBe('PLAYBACK_PLAY');
    expect(received.payload.position).toBe(45.5);
    expect(received.revision).toBe(1);

    ws.close();
  });

  it('enforces per-socket rate limiting when message threshold is exceeded', async () => {
    const ticket = randomUUID();
    const roomId = '9c858901-8a57-4791-81fe-4c455b099bc9';
    const userId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    mockRedisState.store.set(
      `ticket:${ticket}`,
      JSON.stringify({
        userId,
        displayName: 'Host_User',
        roomId,
        memberId: 'member-1',
        role: 'HOST',
      }),
    );

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws?ticket=${ticket}`);

    await new Promise<void>((resolve) => {
      ws.once('message', () => resolve()); // Ignore initial snapshot
    });

    const rateLimitPromise = new Promise<{ error: string }>((resolve) => {
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.error === 'RATE_LIMITED') resolve(parsed);
      });
    });

    // Spam 30 probe messages rapidly
    for (let i = 0; i < 30; i++) {
      ws.send(JSON.stringify({ type: 'CLOCK_SYNC_PROBE', t1: Date.now() }));
    }

    const res = await rateLimitPromise;
    expect(res.error).toBe('RATE_LIMITED');

    ws.close();
  });
});
