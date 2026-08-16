import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';

interface MockUser {
  id: string;
  displayName: string;
  isGuest: boolean;
  status: string;
  createdAt: Date;
}

interface MockRoom {
  id: string;
  roomCode: string;
  name: string;
  hostUserId: string;
  status: string;
  createdAt: Date;
  settings: {
    maxParticipants: number;
    isLocked: boolean;
    allowGuestChat: boolean;
    allowGuestVoice: boolean;
  };
  playbackState: {
    status: string;
    position: number;
    playbackRate: number;
    revision: bigint;
  };
}

// Mock database calls for fast isolated unit tests
vi.mock('@huddly/database', () => {
  const users: MockUser[] = [];
  const rooms: MockRoom[] = [];

  return {
    prisma: {
      user: {
        create: vi
          .fn()
          .mockImplementation(
            async ({
              data,
            }: {
              data: { displayName: string; isGuest?: boolean; status?: string };
            }) => {
              const user: MockUser = {
                id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
                displayName: data.displayName,
                isGuest: data.isGuest ?? false,
                status: data.status ?? 'ACTIVE',
                createdAt: new Date(),
              };
              users.push(user);
              return user;
            },
          ),
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
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
            };
          }) => {
            const room: MockRoom = {
              id: '9c858901-8a57-4791-81fe-4c455b099bc9',
              roomCode: data.roomCode,
              name: data.name,
              hostUserId: data.hostUser.connect.id,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
              settings: {
                maxParticipants: 10,
                isLocked: false,
                allowGuestChat: true,
                allowGuestVoice: true,
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
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; roomCode?: string } }) => {
            const code = where.roomCode || where.id;
            const found = rooms.find((r) => r.roomCode === code || r.id === code);
            if (!found) return null;
            return {
              ...found,
              hostUser: { id: found.hostUserId, displayName: 'Host_User' },
              members: [],
            };
          }),
      },
      roomMember: {
        findUnique: vi.fn().mockImplementation(async () => ({
          id: 'member-123',
          role: 'HOST',
          status: 'JOINED',
        })),
        upsert: vi
          .fn()
          .mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
            id: 'member-123',
            ...create,
            joinedAt: new Date(),
          })),
      },
    },
  };
});

describe('REST API Service (@huddly/api)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('POST /api/v1/auth/guest generates guest user and JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      payload: { displayName: 'Bhargav' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.displayName).toBe('Bhargav');
    expect(body.user.isGuest).toBe(true);
    expect(typeof body.token).toBe('string');
  });

  it('POST /api/v1/rooms requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      payload: { name: 'Dune Night' },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('ERR_UNAUTHORIZED');
  });

  it('POST /api/v1/rooms creates room with authenticated token', async () => {
    // 1. Get token
    const authRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      payload: { displayName: 'Host_User' },
    });
    const { token } = JSON.parse(authRes.body);

    // 2. Create room
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/rooms',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Dune Night', mediaUrl: 'https://youtube.com/watch?v=123' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.name).toBe('Dune Night');
    expect(body.roomCode).toMatch(/^hud-[a-z0-9]{4}$/);
    expect(body.playbackState.status).toBe('PAUSED');
  });
});
