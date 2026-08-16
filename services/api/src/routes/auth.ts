import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@huddly/database';

const GuestLoginSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
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

    const token = fastify.jwt.sign({
      sub: user.id,
      displayName: user.displayName,
      isGuest: user.isGuest,
    });

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
