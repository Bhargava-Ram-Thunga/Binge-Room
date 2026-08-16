import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import { prisma, type Prisma } from '@huddly/database';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 4);

function generateRoomCode(): string {
  return `hud-${nanoid()}`;
}

type RoomMemberWithUser = Prisma.RoomMemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        displayName: true;
        avatarUrl: true;
      };
    };
  };
}>;

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100).default('Watch Room'),
  mediaUrl: z.string().url().optional(),
  settings: z
    .object({
      maxParticipants: z.number().int().min(2).max(100).optional(),
      isLocked: z.boolean().optional(),
      allowGuestChat: z.boolean().optional(),
      allowGuestVoice: z.boolean().optional(),
    })
    .optional(),
});

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/v1/rooms
   * Create a new watch room and initialize playback state
   */
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string };
    const parseResult = CreateRoomSchema.safeParse(request.body || {});

    if (!parseResult.success) {
      return reply.status(400).send({
        type: 'https://huddly.app/errors/invalid-payload',
        title: 'Invalid Room Creation Request',
        status: 400,
        detail: parseResult.error.issues[0]?.message || 'Invalid payload',
        code: 'ERR_INVALID_PAYLOAD',
      });
    }

    const { name, mediaUrl, settings } = parseResult.data;
    const roomCode = generateRoomCode();

    const roomData: Prisma.RoomCreateInput = {
      roomCode,
      name,
      hostUser: { connect: { id: userPayload.sub } },
      status: 'ACTIVE',
      settings: {
        create: {
          maxParticipants: settings?.maxParticipants ?? 10,
          isLocked: settings?.isLocked ?? false,
          allowGuestChat: settings?.allowGuestChat ?? true,
          allowGuestVoice: settings?.allowGuestVoice ?? true,
          defaultMemberRole: 'PARTICIPANT',
        },
      },
      members: {
        create: {
          userId: userPayload.sub,
          role: 'HOST',
          status: 'JOINED',
        },
      },
      playbackState: {
        create: {
          status: 'PAUSED',
          position: 0.0,
          playbackRate: 1.0,
          revision: 0n,
        },
      },
    };

    if (mediaUrl) {
      roomData.mediaSessions = {
        create: {
          mediaUrl,
          sourceType: 'GENERIC_HTML5',
        },
      };
    }

    const room = await prisma.room.create({
      data: roomData,
      include: {
        settings: true,
        playbackState: true,
      },
    });

    return reply.status(201).send({
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      status: room.status,
      hostUserId: room.hostUserId,
      inviteUrl: `https://huddly.app/join/${room.roomCode}`,
      settings: room.settings,
      playbackState: {
        status: room.playbackState?.status,
        position: room.playbackState?.position,
        playbackRate: room.playbackState?.playbackRate,
        revision: Number(room.playbackState?.revision || 0n),
      },
      createdAt: room.createdAt,
    });
  });

  /**
   * GET /api/v1/rooms/:code
   * Resolve room by code or UUID
   */
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const isUuid = code.length === 36 && code.includes('-');
    const room = await prisma.room.findFirst({
      where: isUuid ? { id: code } : { roomCode: code },
      include: {
        settings: true,
        playbackState: true,
        hostUser: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        members: {
          where: { status: 'JOINED' },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found',
        status: 404,
        detail: `The room with code '${code}' was not found.`,
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    return reply.send({
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      status: room.status,
      host: room.hostUser,
      settings: room.settings,
      memberCount: room.members.length,
      members: room.members.map((m: RoomMemberWithUser) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      playbackState: room.playbackState
        ? {
            status: room.playbackState.status,
            position: room.playbackState.position,
            playbackRate: room.playbackState.playbackRate,
            revision: Number(room.playbackState.revision),
          }
        : null,
      createdAt: room.createdAt,
    });
  });

  /**
   * POST /api/v1/rooms/:id/join
   * Join an active room as participant
   */
  fastify.post('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userPayload = request.user as { sub: string };
    const { id } = request.params as { id: string };

    const room = await prisma.room.findUnique({
      where: { id },
      include: { settings: true, members: { where: { status: 'JOINED' } } },
    });

    if (!room || room.status !== 'ACTIVE') {
      return reply.status(404).send({
        type: 'https://huddly.app/errors/room-not-found',
        title: 'Room Not Found or Closed',
        status: 404,
        detail: 'Cannot join room because it does not exist or has closed.',
        code: 'ERR_ROOM_NOT_FOUND',
      });
    }

    if (room.settings?.isLocked) {
      return reply.status(403).send({
        type: 'https://huddly.app/errors/room-locked',
        title: 'Room Locked',
        status: 403,
        detail: 'This room is currently locked by the host.',
        code: 'ERR_ROOM_LOCKED',
      });
    }

    if (room.settings && room.members.length >= room.settings.maxParticipants) {
      return reply.status(409).send({
        type: 'https://huddly.app/errors/room-full',
        title: 'Room Full',
        status: 409,
        detail: 'The room has reached maximum participant capacity.',
        code: 'ERR_ROOM_FULL',
      });
    }

    const membership = await prisma.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: userPayload.sub,
        },
      },
      update: {
        status: 'JOINED',
        leftAt: null,
      },
      create: {
        roomId: room.id,
        userId: userPayload.sub,
        role: room.hostUserId === userPayload.sub ? 'HOST' : 'PARTICIPANT',
        status: 'JOINED',
      },
    });

    return reply.status(200).send({
      roomId: room.id,
      memberId: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
    });
  });
};
