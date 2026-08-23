import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../server.js';
import { hashPassword, hashRefreshToken } from '../utils/security.js';

interface MockAuditEvent {
  id: string;
  actorUserId: string | null;
  roomId: string | null;
  eventType: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

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
  user?: MockUser | undefined;
}

const mockAuditEvents: MockAuditEvent[] = [];
const mockUsers: MockUser[] = [];
const mockDevices: MockUserDevice[] = [];

// Mock Redis
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
  return {
    Redis: MockRedis,
    default: MockRedis,
  };
});

// Mock database
vi.mock('@huddly/database', () => {
  return {
    prisma: {
      auditEvent: {
        create: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
          const event: MockAuditEvent = {
            id: `audit-${mockAuditEvents.length + 1}`,
            actorUserId: data.actorUserId ?? null,
            roomId: data.roomId ?? null,
            eventType: data.eventType,
            details: data.details ?? {},
            createdAt: new Date(),
          };
          mockAuditEvents.push(event);
          return event;
        }),
      },
      user: {
        create: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
          const user: MockUser = {
            id: `user-${mockUsers.length + 1}`,
            email: data.email ?? null,
            passwordHash: data.passwordHash ?? null,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl ?? null,
            isGuest: data.isGuest ?? false,
            status: data.status ?? 'ACTIVE',
            createdAt: new Date(),
          };
          mockUsers.push(user);

          if (data.devices?.create) {
            mockDevices.push({
              id: `device-${mockDevices.length + 1}`,
              userId: user.id,
              deviceType: data.devices.create.deviceType ?? 'WEB',
              userAgent: data.devices.create.userAgent ?? null,
              refreshTokenHash: data.devices.create.refreshTokenHash ?? null,
              lastSeenAt: new Date(),
              createdAt: new Date(),
              user,
            });
          }
          return user;
        }),
        findUnique: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
            if (where.id) {
              return mockUsers.find((u) => u.id === where.id) || null;
            }
            if (where.email) {
              return mockUsers.find((u) => u.email === where.email) || null;
            }
            return null;
          }),
        update: vi
          .fn()
          .mockImplementation(async ({ where, data }: { where: { id: string }; data: any }) => {
            const user = mockUsers.find((u) => u.id === where.id);
            if (user) {
              Object.assign(user, data);
            }
            return user;
          }),
      },
      userDevice: {
        create: vi.fn().mockImplementation(async ({ data }: { data: any }) => {
          const user = mockUsers.find((u) => u.id === data.userId);
          const device: MockUserDevice = {
            id: `device-${mockDevices.length + 1}`,
            userId: data.userId,
            deviceType: data.deviceType ?? 'WEB',
            userAgent: data.userAgent ?? null,
            refreshTokenHash: data.refreshTokenHash ?? null,
            lastSeenAt: new Date(),
            createdAt: new Date(),
            user,
          };
          mockDevices.push(device);
          return device;
        }),
        findFirst: vi
          .fn()
          .mockImplementation(async ({ where }: { where: { refreshTokenHash?: string } }) => {
            const dev = mockDevices.find((d) => d.refreshTokenHash === where.refreshTokenHash);
            if (dev && !dev.user) {
              dev.user = mockUsers.find((u) => u.id === dev.userId);
            }
            return dev || null;
          }),
        update: vi
          .fn()
          .mockImplementation(async ({ where, data }: { where: { id: string }; data: any }) => {
            const dev = mockDevices.find((d) => d.id === where.id);
            if (dev) {
              Object.assign(dev, data);
            }
            return dev;
          }),
        updateMany: vi.fn().mockImplementation(async () => {
          return { count: 1 };
        }),
      },
    },
  };
});

describe('Auth Error Handling & Audit Event Telemetry (AUTH-008)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockAuditEvents.length = 0;
    mockUsers.length = 0;
    mockDevices.length = 0;
  });

  it('records AUTH_REGISTER_SUCCESS when a new user registers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'audit.register@example.com',
        password: 'Password123!',
        displayName: 'Audit User',
        deviceType: 'CHROME_EXT',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('audit.register@example.com');

    // Yield microtask to allow fire-and-forget audit write to complete
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockAuditEvents).toHaveLength(1);
    expect(mockAuditEvents[0]?.eventType).toBe('AUTH_REGISTER_SUCCESS');
    expect(mockAuditEvents[0]?.actorUserId).toBe(body.user.id);
    expect(mockAuditEvents[0]?.details['email']).toBe('audit.register@example.com');
    expect(mockAuditEvents[0]?.details['deviceType']).toBe('CHROME_EXT');
  });

  it('records AUTH_LOGIN_SUCCESS when credentials are valid', async () => {
    const passwordHash = await hashPassword('SecretPass123!');
    const user: MockUser = {
      id: 'audit-user-login-1',
      email: 'audit.login@example.com',
      passwordHash,
      displayName: 'Audit Login User',
      avatarUrl: null,
      isGuest: false,
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    mockUsers.push(user);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'audit.login@example.com',
        password: 'SecretPass123!',
        deviceType: 'WEB',
      },
    });

    expect(res.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const loginEvents = mockAuditEvents.filter((e) => e.eventType === 'AUTH_LOGIN_SUCCESS');
    expect(loginEvents).toHaveLength(1);
    expect(loginEvents[0]?.actorUserId).toBe('audit-user-login-1');
    expect(loginEvents[0]?.details['email']).toBe('audit.login@example.com');
  });

  it('records AUTH_LOGIN_FAILURE and returns RFC 7807 problem details on invalid password', async () => {
    const passwordHash = await hashPassword('CorrectPassword123!');
    const user: MockUser = {
      id: 'audit-user-login-2',
      email: 'audit.fail@example.com',
      passwordHash,
      displayName: 'Fail Login User',
      avatarUrl: null,
      isGuest: false,
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    mockUsers.push(user);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'audit.fail@example.com',
        password: 'WrongPassword!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.type).toBe('https://huddly.app/errors/invalid-credentials');
    expect(body.code).toBe('ERR_INVALID_CREDENTIALS');
    expect(body.status).toBe(401);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const failEvents = mockAuditEvents.filter((e) => e.eventType === 'AUTH_LOGIN_FAILURE');
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]?.actorUserId).toBe('audit-user-login-2');
    expect(failEvents[0]?.details['email']).toBe('audit.fail@example.com');
    expect(failEvents[0]?.details['reason']).toBe('Invalid password');
  });

  it('records AUTH_LOGIN_FAILURE when user email does not exist', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 20));

    const failEvents = mockAuditEvents.filter((e) => e.eventType === 'AUTH_LOGIN_FAILURE');
    expect(failEvents).toHaveLength(1);
    expect(failEvents[0]?.actorUserId).toBeNull();
    expect(failEvents[0]?.details['email']).toBe('nonexistent@example.com');
  });

  it('records AUTH_REFRESH_SUCCESS and AUTH_REFRESH_FAILURE on token rotation', async () => {
    const user: MockUser = {
      id: 'audit-refresh-user',
      email: 'refresh@example.com',
      passwordHash: 'hash',
      displayName: 'Refresh User',
      avatarUrl: null,
      isGuest: false,
      status: 'ACTIVE',
      createdAt: new Date(),
    };
    mockUsers.push(user);

    const tokenHash = hashRefreshToken('valid-raw-refresh-token');
    mockDevices.push({
      id: 'device-refresh-1',
      userId: user.id,
      deviceType: 'WEB',
      userAgent: null,
      refreshTokenHash: tokenHash,
      lastSeenAt: new Date(),
      createdAt: new Date(),
      user,
    });

    // Valid refresh
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: 'valid-raw-refresh-token',
      },
    });
    expect(validRes.statusCode).toBe(200);

    // Invalid refresh
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: 'completely-invalid-token',
      },
    });
    expect(invalidRes.statusCode).toBe(401);
    const invalidBody = JSON.parse(invalidRes.body);
    expect(invalidBody.code).toBe('ERR_INVALID_TOKEN');

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockAuditEvents.some((e) => e.eventType === 'AUTH_REFRESH_SUCCESS')).toBe(true);
    expect(mockAuditEvents.some((e) => e.eventType === 'AUTH_REFRESH_FAILURE')).toBe(true);
  });

  it('records AUTH_GUEST_CREATED when a guest session is initiated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      payload: {
        displayName: 'Guest Viewer',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const guestEvents = mockAuditEvents.filter((e) => e.eventType === 'AUTH_GUEST_CREATED');
    expect(guestEvents).toHaveLength(1);
    expect(guestEvents[0]?.actorUserId).toBe(body.user.id);
    expect(guestEvents[0]?.details['displayName']).toBe('Guest Viewer');
  });

  it('records AUTH_LOGOUT on logout request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: {
        refreshToken: 'any-token',
      },
    });

    expect(res.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const logoutEvents = mockAuditEvents.filter((e) => e.eventType === 'AUTH_LOGOUT');
    expect(logoutEvents).toHaveLength(1);
  });
});
