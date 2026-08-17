import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestServer, cleanupTestServer, generateToken } from '../test-utils.js';

interface MockUser {
  id: string;
  email: string | null;
  displayName: string;
}

interface MockRoom {
  id: string;
  roomCode: string;
  name: string;
  hostUserId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  settings: {
    maxParticipants: number;
    isLocked: boolean;
    allowGuestChat: boolean;
    allowGuestVoice: boolean;
    autoCloseOnHostLeave?: boolean;
  };
  playbackState: {
    status: string;
    position: number;
    playbackRate: number;
    revision: bigint;
  };
}

vi.mock('ioredis', () => {
  class MockRedis {
    async setex() {
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
  const users: MockUser[] = [
    { id: 'user-host-1', email: 'host@test.com', displayName: 'Host User' },
    { id: 'user-other-2', email: 'other@test.com', displayName: 'Other User' },
  ];
  const rooms: MockRoom[] = [];

  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id?: string } }) => {
          return users.find((u) => u.id === where.id) || null;
        }),
      },
      room: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              roomCode: string;
              name: string;
              hostUser: { connect: { id: string } };
              status?: string;
              settings?: { create?: Record<string, unknown> };
            };
          }) => {
            const room: MockRoom = {
              id: `room-${rooms.length + 1}`,
              roomCode: data.roomCode,
              name: data.name,
              hostUserId: data.hostUser.connect.id,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
              settings: {
                maxParticipants: (data.settings?.create?.maxParticipants as number) ?? 10,
                isLocked: (data.settings?.create?.isLocked as boolean) ?? false,
                allowGuestChat: (data.settings?.create?.allowGuestChat as boolean) ?? true,
                allowGuestVoice: (data.settings?.create?.allowGuestVoice as boolean) ?? true,
              },
              playbackState: {
                status: 'PAUSED',
                position: 0.0,
                playbackRate: 1.0,
                revision: 0n,
              },
            };
            rooms.push(room);
            return room;
          },
        ),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const found = rooms.find((r) => r.id === where.id);
          if (!found) return null;
          return {
            ...found,
            members: [{ userId: found.hostUserId, status: 'JOINED' }],
          };
        }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; roomCode?: string } }) => {
            const code = where.roomCode || where.id;
            const found = rooms.find((r) => r.roomCode === code || r.id === code);
            if (!found) return null;
            return {
              ...found,
              hostUser: { id: found.hostUserId, displayName: 'Host User' },
              members: [
                {
                  id: 'm-1',
                  userId: found.hostUserId,
                  role: 'HOST',
                  status: 'JOINED',
                  user: { displayName: 'Host User', avatarUrl: null },
                },
              ],
            };
          }),
        update: vi.fn().mockImplementation(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              name?: string;
              status?: string;
              settings?: { update?: Record<string, unknown> };
            };
          }) => {
            const index = rooms.findIndex((r) => r.id === where.id);
            if (index === -1) throw new Error('Room not found');
            const current = rooms[index]!;
            const updated: MockRoom = {
              ...current,
              name: data.name ?? current.name,
              status: data.status ?? current.status,
              updatedAt: new Date(),
              settings: {
                ...current.settings,
                ...(data.settings?.update || {}),
              },
            };
            rooms[index] = updated;
            return {
              ...updated,
              members: [{ userId: updated.hostUserId, status: 'JOINED' }],
            };
          },
        ),
      },
      roomMember: {
        findUnique: vi.fn().mockImplementation(async () => ({
          id: 'member-1',
          role: 'HOST',
          status: 'JOINED',
        })),
        upsert: vi
          .fn()
          .mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
            id: 'member-1',
            ...create,
            joinedAt: new Date(),
          })),
      },
    },
  };
});

describe('Room Management Endpoints (ROOM-001)', () => {
  let fastify: FastifyInstance;
  let hostToken: string;
  let otherToken: string;
  let createdRoomId: string;
  let createdRoomCode: string;

  beforeAll(async () => {
    fastify = await createTestServer();
    hostToken = generateToken(fastify, 'user-host-1', 'host@test.com', 'Host User');
    otherToken = generateToken(fastify, 'user-other-2', 'other@test.com', 'Other User');
  });

  afterAll(async () => {
    await cleanupTestServer(fastify);
  });

  describe('POST /api/v1/rooms (Create)', () => {
    it('creates a new room with authenticated user', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: {
          name: 'Movie Night',
          settings: { maxParticipants: 5 },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('roomCode');
      expect(body.name).toBe('Movie Night');
      expect(body.hostUserId).toBe('user-host-1');
      expect(body.status).toBe('ACTIVE');
      createdRoomId = body.id;
      createdRoomCode = body.roomCode;
    });

    it('rejects unauthenticated requests with 401', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        payload: { name: 'Unauthorized Room' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects invalid payload with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });
  });

  describe('GET /api/v1/rooms/:code (Fetch)', () => {
    it('fetches room by code publicly', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/rooms/${createdRoomCode}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(createdRoomId);
      expect(body.roomCode).toBe(createdRoomCode);
    });

    it('returns 404 for non-existent code', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/rooms/non-existent-code',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('ERR_ROOM_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/rooms/:id (Update Settings)', () => {
    it('allows room host to update settings', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: {
          name: 'Updated Movie Night',
          isLocked: true,
          maxParticipants: 8,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Updated Movie Night');
      expect(body.settings.isLocked).toBe(true);
      expect(body.settings.maxParticipants).toBe(8);
    });

    it('rejects non-host updates with 403 Forbidden', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked Title' },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('ERR_FORBIDDEN');
    });

    it('returns 404 for non-existent room', async () => {
      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/rooms/non-existent-id',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Ghost Room' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/rooms/:id (Close Room)', () => {
    it('rejects non-host close attempts with 403', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('ERR_FORBIDDEN');
    });

    it('allows room host to soft-close the room', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${createdRoomId}`,
        headers: { authorization: `Bearer ${hostToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('CLOSED');
      expect(body.message).toBe('Room closed successfully');
    });
  });
});
