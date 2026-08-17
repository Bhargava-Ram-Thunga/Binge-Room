import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './server.js';

interface MockUser {
  id: string;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  status: string;
  createdAt: Date;
}

interface MockUserDevice {
  id: string;
  userId: string;
  deviceType: string;
  userAgent: string | null;
  refreshTokenHash: string | null;
  lastSeenAt: Date;
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
  const devices: MockUserDevice[] = [];
  const rooms: MockRoom[] = [];

  return {
    prisma: {
      user: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              email?: string | null;
              passwordHash?: string | null;
              displayName: string;
              avatarUrl?: string | null;
              isGuest?: boolean;
              status?: string;
              devices?: {
                create?: {
                  deviceType?: string;
                  userAgent?: string | null;
                  refreshTokenHash?: string | null;
                };
              };
            };
          }) => {
            const user: MockUser = {
              id: `user-${users.length + 1}-${Date.now()}`,
              email: data.email ?? null,
              passwordHash: data.passwordHash ?? null,
              displayName: data.displayName,
              avatarUrl: data.avatarUrl ?? null,
              isGuest: data.isGuest ?? false,
              status: data.status ?? 'ACTIVE',
              createdAt: new Date(),
            };
            users.push(user);

            if (data.devices?.create) {
              devices.push({
                id: `device-${devices.length + 1}`,
                userId: user.id,
                deviceType: data.devices.create.deviceType ?? 'WEB',
                userAgent: data.devices.create.userAgent ?? null,
                refreshTokenHash: data.devices.create.refreshTokenHash ?? null,
                lastSeenAt: new Date(),
                createdAt: new Date(),
              });
            }

            return user;
          },
        ),
        findUnique: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
            if (where.id) {
              return users.find((u) => u.id === where.id) || null;
            }
            if (where.email) {
              return users.find((u) => u.email === where.email) || null;
            }
            return null;
          }),
      },
      userDevice: {
        create: vi.fn().mockImplementation(
          async ({
            data,
          }: {
            data: {
              userId: string;
              deviceType?: string;
              userAgent?: string | null;
              refreshTokenHash?: string | null;
            };
          }) => {
            const device: MockUserDevice = {
              id: `device-${devices.length + 1}`,
              userId: data.userId,
              deviceType: data.deviceType ?? 'WEB',
              userAgent: data.userAgent ?? null,
              refreshTokenHash: data.refreshTokenHash ?? null,
              lastSeenAt: new Date(),
              createdAt: new Date(),
            };
            devices.push(device);
            return device;
          },
        ),
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

  describe('Healthcheck', () => {
    it('GET /health returns 200 ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('Guest Authentication (AUTH-005)', () => {
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
  });

  describe('Email/Password Registration (AUTH-002)', () => {
    it('POST /api/v1/auth/register successfully registers a new user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
          displayName: 'Alice',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.user.email).toBe('alice@example.com');
      expect(body.user.displayName).toBe('Alice');
      expect(body.user.isGuest).toBe(false);
      expect(body.user.passwordHash).toBeUndefined(); // Must not leak password hash
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('POST /api/v1/auth/register rejects duplicate email with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'ALICE@EXAMPLE.COM', // Tests case-insensitivity normalization
          password: 'AnotherPassword123!',
          displayName: 'Alice Duplicate',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_EMAIL_EXISTS');
      expect(body.status).toBe(409);
    });

    it('POST /api/v1/auth/register rejects invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'Password123!',
          displayName: 'Bad Email',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });

    it('POST /api/v1/auth/register rejects short passwords (<8 chars)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'short@example.com',
          password: 'short',
          displayName: 'Short Pass',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_PAYLOAD');
    });
  });

  describe('Email/Password Login (AUTH-002)', () => {
    it('POST /api/v1/auth/login succeeds with correct credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.user.email).toBe('alice@example.com');
      expect(body.user.displayName).toBe('Alice');
      expect(body.user.passwordHash).toBeUndefined();
      expect(typeof body.token).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('POST /api/v1/auth/login rejects incorrect password with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'WrongPassword999!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_CREDENTIALS');
    });

    it('POST /api/v1/auth/login rejects non-existent email with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_INVALID_CREDENTIALS');
    });
  });

  describe('Authenticated Profile (GET /me)', () => {
    it('GET /api/v1/auth/me returns profile for registered user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'alice@example.com',
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.body);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(meRes.statusCode).toBe(200);
      const body = JSON.parse(meRes.body);
      expect(body.email).toBe('alice@example.com');
      expect(body.displayName).toBe('Alice');
      expect(body.isGuest).toBe(false);
      expect(body.passwordHash).toBeUndefined();
    });

    it('GET /api/v1/auth/me rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('ERR_UNAUTHORIZED');
    });
  });

  describe('Rooms & Protected Endpoints', () => {
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
      const authRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/guest',
        payload: { displayName: 'Host_User' },
      });
      const { token } = JSON.parse(authRes.body);

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
});
