import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@huddly/database';
import {
  hashPassword,
  verifyPassword,
  dummyVerify,
  generateRefreshToken,
  hashRefreshToken,
  normalizeEmail,
} from '../utils/security.js';

const GuestLoginSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
});

const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name cannot exceed 50 characters'),
  deviceType: z.string().max(50).optional(),
  userAgent: z.string().max(512).optional(),
});

const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required').max(128),
  deviceType: z.string().max(50).optional(),
  userAgent: z.string().max(512).optional(),
});

const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/auth/register
   * Register a new user with email, password (Argon2id), and display name
   */
  fastify.post('/register', async (request, reply) => {
    const parseResult = RegisterRequestSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Registration Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { password, displayName, deviceType, userAgent } = parseResult.data;
    const email = normalizeEmail(parseResult.data.email);

    // Check for existing account
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.status(409).send({
        type: 'https://huddly.app/errors/email-already-exists',
        title: 'Email Already Exists',
        status: 409,
        detail: 'An account with this email address already exists.',
        code: 'ERR_EMAIL_EXISTS',
      });
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);
    const { rawToken, tokenHash } = generateRefreshToken();
    const resolvedUserAgent = (userAgent || (request.headers['user-agent'] as string) || null) as
      string | null;

    // Create user and device record atomically
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        isGuest: false,
        status: 'ACTIVE',
        devices: {
          create: {
            deviceType: deviceType || 'WEB',
            userAgent: resolvedUserAgent,
            refreshTokenHash: tokenHash,
          },
        },
      },
    });

    const accessToken = fastify.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        displayName: user.displayName,
        isGuest: user.isGuest,
      },
      { expiresIn: '15m' },
    );

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: user.isGuest,
        status: user.status,
        createdAt: user.createdAt,
      },
      token: accessToken,
      refreshToken: rawToken,
    });
  });

  /**
   * POST /api/v1/auth/login
   * Authenticate user with email and password via Argon2id
   */
  fastify.post('/login', async (request, reply) => {
    const parseResult = LoginRequestSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Login Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { password, deviceType, userAgent } = parseResult.data;
    const email = normalizeEmail(parseResult.data.email);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Timing-attack mitigation: execute dummy verify if user is not found or has no password
    if (!user || !user.passwordHash) {
      await dummyVerify();
      return reply.status(401).send({
        type: 'https://huddly.app/errors/invalid-credentials',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid email or password.',
        code: 'ERR_INVALID_CREDENTIALS',
      });
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      return reply.status(401).send({
        type: 'https://huddly.app/errors/invalid-credentials',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid email or password.',
        code: 'ERR_INVALID_CREDENTIALS',
      });
    }

    if (user.status !== 'ACTIVE') {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/account-inactive',
        title: 'Account Inactive',
        status: 403,
        detail: 'This account has been suspended or deactivated.',
        code: 'ERR_ACCOUNT_INACTIVE',
      });
    }

    // Generate new refresh token and register device session
    const { rawToken, tokenHash } = generateRefreshToken();
    const resolvedUserAgent = (userAgent || (request.headers['user-agent'] as string) || null) as
      string | null;

    await prisma.userDevice.create({
      data: {
        userId: user.id,
        deviceType: deviceType || 'WEB',
        userAgent: resolvedUserAgent,
        refreshTokenHash: tokenHash,
        lastSeenAt: new Date(),
      },
    });

    const accessToken = fastify.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        displayName: user.displayName,
        isGuest: user.isGuest,
      },
      { expiresIn: '15m' },
    );

    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: user.isGuest,
        status: user.status,
        createdAt: user.createdAt,
      },
      token: accessToken,
      refreshToken: rawToken,
    });
  });

  /**
   * POST /api/v1/auth/refresh
   * Rotate refresh token and issue new access token (RFC 9700 RTR)
   */
  fastify.post('/refresh', async (request, reply) => {
    const parseResult = RefreshRequestSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Refresh Payload',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { refreshToken } = parseResult.data;
    const tokenHash = hashRefreshToken(refreshToken);

    const device = await prisma.userDevice.findFirst({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!device || !device.user) {
      return reply.status(401).send({
        type: 'https://huddly.app/errors/invalid-token',
        title: 'Invalid Refresh Token',
        status: 401,
        detail: 'The provided refresh token is invalid, expired, or has already been used.',
        code: 'ERR_INVALID_TOKEN',
      });
    }

    if (device.user.status !== 'ACTIVE') {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/account-inactive',
        title: 'Account Inactive',
        status: 403,
        detail: 'This account has been suspended or deactivated.',
        code: 'ERR_ACCOUNT_INACTIVE',
      });
    }

    // 7-day expiration check
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(device.lastSeenAt).getTime() > SEVEN_DAYS_MS) {
      await prisma.userDevice.update({
        where: { id: device.id },
        data: { refreshTokenHash: null },
      });

      return reply.status(401).send({
        type: 'https://huddly.app/errors/token-expired',
        title: 'Refresh Token Expired',
        status: 401,
        detail: 'The refresh token has expired (maximum 7 days). Please log in again.',
        code: 'ERR_TOKEN_EXPIRED',
      });
    }

    // Rotate refresh token: mint new token, invalidate previous token
    const { rawToken: newRawToken, tokenHash: newTokenHash } = generateRefreshToken();

    await prisma.userDevice.update({
      where: { id: device.id },
      data: {
        refreshTokenHash: newTokenHash,
        lastSeenAt: new Date(),
      },
    });

    const newAccessToken = fastify.jwt.sign(
      {
        sub: device.user.id,
        email: device.user.email,
        displayName: device.user.displayName,
        isGuest: device.user.isGuest,
      },
      { expiresIn: '15m' },
    );

    return reply.status(200).send({
      token: newAccessToken,
      refreshToken: newRawToken,
    });
  });

  /**
   * POST /api/v1/auth/logout
   * Revoke device session and invalidate refresh token
   */
  fastify.post('/logout', async (request, reply) => {
    const parseResult = LogoutRequestSchema.safeParse(request.body || {});
    const refreshToken = parseResult.success ? parseResult.data.refreshToken : undefined;

    let userId: string | undefined;
    try {
      const decoded = await request.jwtVerify<{ sub: string }>();
      userId = decoded?.sub;
    } catch {
      // Optional Bearer token
    }

    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.userDevice.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { refreshTokenHash: null },
      });
    } else if (userId) {
      await prisma.userDevice.updateMany({
        where: { userId },
        data: { refreshTokenHash: null },
      });
    }

    return reply.status(200).send({
      message: 'Logged out successfully',
    });
  });

  /**
   * POST /api/v1/auth/guest
   * Instant anonymous guest session generation
   */
  fastify.post('/guest', async (request, reply) => {
    const parseResult = GuestLoginSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Guest Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const name = parseResult.data.displayName || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;

    const user = await prisma.user.create({
      data: {
        displayName: name,
        isGuest: true,
        status: 'ACTIVE',
      },
    });

    const token = fastify.jwt.sign(
      {
        sub: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
      },
      { expiresIn: '15m' },
    );

    return reply.status(201).send({
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
        createdAt: user.createdAt,
      },
      token,
    });
  });

  /**
   * GET /api/v1/auth/me
   * Retrieve current authenticated user profile
   */
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: userPayload.sub },
    });

    if (!user) {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/user-not-found',
        title: 'User Not Found',
        status: 404,
        detail: 'The authenticated user was not found',
        code: 'ERR_USER_NOT_FOUND',
      });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isGuest: user.isGuest,
      status: user.status,
      createdAt: user.createdAt,
    });
  });
};
