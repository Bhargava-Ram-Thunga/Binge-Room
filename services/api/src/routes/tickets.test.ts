import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, cleanupTestServer, generateToken } from '../test-utils.js';

vi.mock('ioredis', () => {
  const store = new Map<string, string>();
  class MockRedis {
    async setex(key: string, _ttl: number, val: string) {
      store.set(key, val);
      return 'OK';
    }
    async quit() {
      return 'OK';
    }
    on() {}
  }
  return { Redis: MockRedis, default: MockRedis };
});

vi.mock('@huddly/database', () => {
  return {
    prisma: {
      roomMember: {
        findUnique: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { roomId_userId?: unknown } }) => {
            if (where.roomId_userId) {
              return {
                id: 'member-ticket-123',
                role: 'PARTICIPANT',
                status: 'JOINED',
              };
            }
            return null;
          }),
      },
    },
  };
});

describe('Realtime Ticket Endpoints (REALTIME-002)', () => {
  let fastify: FastifyInstance;
  let authToken: string;
  const validRoomId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeAll(async () => {
    fastify = await createTestServer();
    authToken = generateToken(fastify, 'user-ticket-1', 'ticket@test.com', 'Ticket Tester');
  });

  afterAll(async () => {
    await cleanupTestServer(fastify);
  });

  describe('POST /api/v1/realtime/ticket', () => {
    it('generates a valid connection ticket for room members', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          roomId: validRoomId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('ticket');
      expect(body.ticket).toMatch(/^[a-f0-9-]{36}$/);
      expect(body.expiresIn).toBe(60);
      expect(body).toHaveProperty('wsUrl');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        payload: {
          roomId: validRoomId,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects requests without roomId with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('generates unique tickets on separate requests', async () => {
      const res1 = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { roomId: validRoomId },
      });

      const res2 = await fastify.inject({
        method: 'POST',
        url: '/api/v1/realtime/ticket',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { roomId: validRoomId },
      });

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res1.json().ticket).not.toBe(res2.json().ticket);
    });
  });
});
