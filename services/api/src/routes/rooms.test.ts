import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { createTestServer, cleanupTestServer, generateToken } from '../test-utils.js';

interface MockUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface MockRoomSettings {
  maxParticipants: number;
  isLocked: boolean;
  allowGuestChat: boolean;
  allowGuestVoice: boolean;
  autoCloseOnHostLeave?: boolean;
}

interface MockRoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: Date;
  leftAt?: Date | null;
}

interface MockRoom {
  id: string;
  roomCode: string;
  name: string;
  hostUserId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  settings: MockRoomSettings;
  playbackState: {
    status: string;
    position: number;
    playbackRate: number;
    revision: bigint;
  };
}

const mockUsers = new Map<string, MockUser>();
const mockRooms = new Map<string, MockRoom>();
const mockRoomMembers = new Map<string, MockRoomMember[]>();

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
  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id?: string } }) => {
          if (!where.id) return null;
          return mockUsers.get(where.id) || null;
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
              settings?: { create?: Partial<MockRoomSettings> };
            };
          }) => {
            const id = randomUUID();
            const hostUserId = data.hostUser.connect.id;
            const room: MockRoom = {
              id,
              roomCode: data.roomCode,
              name: data.name,
              hostUserId,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
              settings: {
                maxParticipants: data.settings?.create?.maxParticipants ?? 10,
                isLocked: data.settings?.create?.isLocked ?? false,
                allowGuestChat: data.settings?.create?.allowGuestChat ?? true,
                allowGuestVoice: data.settings?.create?.allowGuestVoice ?? true,
                autoCloseOnHostLeave: data.settings?.create?.autoCloseOnHostLeave ?? false,
              },
              playbackState: {
                status: 'PAUSED',
                position: 0.0,
                playbackRate: 1.0,
                revision: 0n,
              },
            };
            mockRooms.set(id, room);
            mockRoomMembers.set(id, [
              {
                id: `member-${randomUUID().slice(0, 8)}`,
                roomId: id,
                userId: hostUserId,
                role: 'HOST',
                status: 'JOINED',
                joinedAt: new Date(),
              },
            ]);
            return room;
          },
        ),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const found = mockRooms.get(where.id);
          if (!found) return null;
          const members = (mockRoomMembers.get(where.id) || []).filter(
            (m) => m.status === 'JOINED',
          );
          return {
            ...found,
            settings: found.settings,
            members,
          };
        }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; roomCode?: string } }) => {
            const codeOrId = where.roomCode || where.id;
            let found: MockRoom | undefined;
            for (const r of mockRooms.values()) {
              if (r.roomCode === codeOrId || r.id === codeOrId) {
                found = r;
                break;
              }
            }
            if (!found) return null;
            const host = mockUsers.get(found.hostUserId) || {
              id: found.hostUserId,
              displayName: 'Host User',
              avatarUrl: null,
              email: null,
            };
            const members = (mockRoomMembers.get(found.id) || [])
              .filter((m) => m.status === 'JOINED')
              .map((m) => {
                const user = mockUsers.get(m.userId) || {
                  id: m.userId,
                  displayName: 'Member User',
                  avatarUrl: null,
                  email: null,
                };
                return {
                  id: m.id,
                  userId: m.userId,
                  role: m.role,
                  status: m.status,
                  joinedAt: m.joinedAt,
                  user: {
                    id: user.id,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                  },
                };
              });
            return {
              ...found,
              hostUser: {
                id: host.id,
                displayName: host.displayName,
                avatarUrl: host.avatarUrl,
              },
              members,
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
              settings?: { update?: Partial<MockRoomSettings> };
            };
          }) => {
            const current = mockRooms.get(where.id);
            if (!current) throw new Error('Room not found');
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
            mockRooms.set(where.id, updated);
            const members = (mockRoomMembers.get(where.id) || []).filter(
              (m) => m.status === 'JOINED',
            );
            return {
              ...updated,
              settings: updated.settings,
              members,
            };
          },
        ),
      },
      roomMember: {
        findUnique: vi
          .fn()
          .mockImplementation(
            async ({
              where,
            }: {
              where: { roomId_userId?: { roomId: string; userId: string } };
            }) => {
              if (!where.roomId_userId) return null;
              const list = mockRoomMembers.get(where.roomId_userId.roomId) || [];
              return list.find((m) => m.userId === where.roomId_userId!.userId) || null;
            },
          ),
        upsert: vi
          .fn()
          .mockImplementation(
            async ({
              where,
              create,
            }: {
              where: { roomId_userId: { roomId: string; userId: string } };
              create: { roomId: string; userId: string; role: string; status: string };
            }) => {
              const list = mockRoomMembers.get(where.roomId_userId.roomId) || [];
              const existing = list.find((m) => m.userId === where.roomId_userId.userId);
              if (existing) {
                existing.status = 'JOINED';
                existing.leftAt = null;
                return existing;
              }
              const created: MockRoomMember = {
                id: `member-${randomUUID().slice(0, 8)}`,
                roomId: create.roomId,
                userId: create.userId,
                role: create.role,
                status: create.status,
                joinedAt: new Date(),
              };
              list.push(created);
              mockRoomMembers.set(where.roomId_userId.roomId, list);
              return created;
            },
          ),
      },
    },
  };
});

describe('Room Management Endpoints (ROOM-001 Comprehensive)', () => {
  let fastify: FastifyInstance;
  let hostToken: string;
  let otherToken: string;
  const hostId = 'user-host-1';
  const otherId = 'user-other-2';

  beforeAll(async () => {
    fastify = await createTestServer();
    hostToken = generateToken(fastify, hostId, 'host@test.com', 'Host User');
    otherToken = generateToken(fastify, otherId, 'other@test.com', 'Other User');
  });

  beforeEach(() => {
    mockUsers.clear();
    mockRooms.clear();
    mockRoomMembers.clear();

    mockUsers.set(hostId, {
      id: hostId,
      email: 'host@test.com',
      displayName: 'Host User',
      avatarUrl: null,
    });
    mockUsers.set(otherId, {
      id: otherId,
      email: 'other@test.com',
      displayName: 'Other User',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await cleanupTestServer(fastify);
  });

  describe('POST /api/v1/rooms (Creation & Boundaries)', () => {
    it('creates a room with default settings when none provided', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Default Watch' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe('Default Watch');
      expect(body.roomCode).toMatch(/^hud-[a-z0-9]{4}$/);
      expect(body.settings.maxParticipants).toBe(10);
      expect(body.settings.isLocked).toBe(false);
      expect(body.settings.allowGuestChat).toBe(true);
      expect(body.playbackState.status).toBe('PAUSED');
      expect(body.playbackState.position).toBe(0);
    });

    it('creates a room with custom settings and media URL', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: {
          name: 'Anime Night',
          mediaUrl: 'https://cdn.example.com/stream.mp4',
          settings: {
            maxParticipants: 25,
            isLocked: false,
            allowGuestChat: false,
            allowGuestVoice: false,
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe('Anime Night');
      expect(body.settings.maxParticipants).toBe(25);
      expect(body.settings.allowGuestChat).toBe(false);
    });

    it('rejects unauthenticated creation requests with 401', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        payload: { name: 'Unauthorized Room' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('ERR_UNAUTHORIZED');
    });

    it('rejects empty room name with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('rejects room name exceeding 100 characters with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'A'.repeat(101) },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('rejects maxParticipants lower than 2 with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Tiny Room', settings: { maxParticipants: 1 } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('rejects maxParticipants exceeding 100 with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Huge Room', settings: { maxParticipants: 101 } },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('rejects invalid mediaUrl format with 400', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Bad Media Room', mediaUrl: 'not-a-valid-url' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('ERR_INVALID_PAYLOAD');
    });
  });

  describe('GET /api/v1/rooms/:code (Resolution & Public Access)', () => {
    it('resolves room by 8-character roomCode without authentication', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Public Watch' },
      });
      const { id, roomCode } = createRes.json();

      const res = await fastify.inject({
        method: 'GET',
        url: `/api/v1/rooms/${roomCode}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(id);
      expect(body.roomCode).toBe(roomCode);
      expect(body.host.displayName).toBe('Host User');
      expect(body.memberCount).toBe(1);
    });

    it('resolves room by UUID id without authentication', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'UUID Watch' },
      });
      const { id } = createRes.json();

      const res = await fastify.inject({
        method: 'GET',
        url: `/api/v1/rooms/${id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(id);
    });

    it('returns 404 for unknown room code', async () => {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/v1/rooms/hud-9999',
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('ERR_ROOM_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/rooms/:id (Host Settings Management)', () => {
    it('allows host to partially update name and lock status', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Initial Name' },
      });
      const { id } = createRes.json();

      const patchRes = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Updated Title', isLocked: true },
      });

      expect(patchRes.statusCode).toBe(200);
      const body = patchRes.json();
      expect(body.name).toBe('Updated Title');
      expect(body.settings.isLocked).toBe(true);
      expect(body.settings.maxParticipants).toBe(10); // Preserved
    });

    it('allows host to update voice and chat permission toggles', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Audio Control Room' },
      });
      const { id } = createRes.json();

      const patchRes = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { allowGuestChat: false, allowGuestVoice: false },
      });

      expect(patchRes.statusCode).toBe(200);
      const body = patchRes.json();
      expect(body.settings.allowGuestChat).toBe(false);
      expect(body.settings.allowGuestVoice).toBe(false);
    });

    it('rejects non-host attempts to update room settings with 403 Forbidden', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Host Controlled Room' },
      });
      const { id } = createRes.json();

      const patchRes = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Malicious Rename' },
      });

      expect(patchRes.statusCode).toBe(403);
      expect(patchRes.json().code).toBe('ERR_FORBIDDEN');
    });

    it('returns 404 when updating non-existent room', async () => {
      const patchRes = await fastify.inject({
        method: 'PATCH',
        url: `/api/v1/rooms/${randomUUID()}`,
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Ghost Room' },
      });

      expect(patchRes.statusCode).toBe(404);
      expect(patchRes.json().code).toBe('ERR_ROOM_NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/rooms/:id (Room Closure)', () => {
    it('allows host to soft-close active room', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Room to Close' },
      });
      const { id } = createRes.json();

      const deleteRes = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${hostToken}` },
      });

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.json().status).toBe('CLOSED');
      expect(deleteRes.json().message).toBe('Room closed successfully');
    });

    it('rejects non-host attempts to delete room with 403 Forbidden', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Protected Room' },
      });
      const { id } = createRes.json();

      const deleteRes = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(deleteRes.statusCode).toBe(403);
      expect(deleteRes.json().code).toBe('ERR_FORBIDDEN');
    });

    it('returns 404 when closing non-existent room', async () => {
      const deleteRes = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${randomUUID()}`,
        headers: { authorization: `Bearer ${hostToken}` },
      });

      expect(deleteRes.statusCode).toBe(404);
      expect(deleteRes.json().code).toBe('ERR_ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/v1/rooms/:id/join (Membership & Capacities)', () => {
    it('allows authenticated user to join an active room', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Joinable Room' },
      });
      const { id } = createRes.json();

      const joinRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(joinRes.statusCode).toBe(200);
      const body = joinRes.json();
      expect(body.roomId).toBe(id);
      expect(body.role).toBe('PARTICIPANT');
    });

    it('rejects unauthenticated join requests with 401', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Auth Check Room' },
      });
      const { id } = createRes.json();

      const joinRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
      });

      expect(joinRes.statusCode).toBe(401);
    });

    it('rejects joining a locked room with 403 Forbidden', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Locked Room', settings: { isLocked: true } },
      });
      const { id } = createRes.json();

      const joinRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(joinRes.statusCode).toBe(403);
      expect(joinRes.json().code).toBe('ERR_ROOM_LOCKED');
    });

    it('rejects joining a full room with 409 Conflict', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Full Room', settings: { maxParticipants: 2 } },
      });
      const { id } = createRes.json();

      // Host is 1st member, add otherUser as 2nd member
      await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      // 3rd user attempts to join
      const thirdUserId = 'user-third-3';
      mockUsers.set(thirdUserId, {
        id: thirdUserId,
        email: 'third@test.com',
        displayName: 'Third User',
        avatarUrl: null,
      });
      const thirdToken = generateToken(fastify, thirdUserId, 'third@test.com', 'Third User');

      const fullJoinRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
        headers: { authorization: `Bearer ${thirdToken}` },
      });

      expect(fullJoinRes.statusCode).toBe(409);
      expect(fullJoinRes.json().code).toBe('ERR_ROOM_FULL');
    });

    it('rejects joining a closed room with 404 Not Found', async () => {
      const createRes = await fastify.inject({
        method: 'POST',
        url: '/api/v1/rooms',
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { name: 'Soon Closed' },
      });
      const { id } = createRes.json();

      await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/rooms/${id}`,
        headers: { authorization: `Bearer ${hostToken}` },
      });

      const joinRes = await fastify.inject({
        method: 'POST',
        url: `/api/v1/rooms/${id}/join`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(joinRes.statusCode).toBe(404);
      expect(joinRes.json().code).toBe('ERR_ROOM_NOT_FOUND');
    });
  });
});
