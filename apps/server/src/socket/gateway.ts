import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { z } from 'zod';
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  PlayPayload,
  PausePayload,
  SeekPayload,
  VideoChangePayload,
  AdStartPayload,
  AdEndPayload,
} from '@syncstream/shared-types';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  ROOM_CODE_REGEX,
  USERNAME_MAX_LENGTH,
} from '@syncstream/event-schema';
import { roomService } from '../rooms/room.service.js';
import { SocketRateLimiter } from '../middleware/rate-limiter.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createRoomSchema = z.object({
  userName: z.string().min(1).max(USERNAME_MAX_LENGTH),
  platform: z.enum(['youtube', 'netflix', 'prime', 'disney', 'twitch', 'vimeo']),
  videoId: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
});

const joinRoomSchema = z.object({
  roomId: z.string().optional(),
  code: z.string().regex(ROOM_CODE_REGEX).optional(),
  userName: z.string().min(1).max(USERNAME_MAX_LENGTH),
  platform: z.enum(['youtube', 'netflix', 'prime', 'disney', 'twitch', 'vimeo']),
});

const syncEventSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1).max(USERNAME_MAX_LENGTH),
  timestamp: z.number(),
  platform: z.enum(['youtube', 'netflix', 'prime', 'disney', 'twitch', 'vimeo']),
  currentTime: z.number().min(0).optional(),
  videoId: z.string().optional(),
  videoUrl: z.string().optional(),
  resumeTime: z.number().min(0).optional(),
  playbackRate: z.number().min(0.1).max(16).optional(),
});

// ─── Socket Gateway ───────────────────────────────────────────────────────────

export function createSocketGateway(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
      credentials: false,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25_000,
    pingTimeout: 10_000,
  });

  const rateLimiter = new SocketRateLimiter();
  // socket → roomId mapping (in-memory, fast lookup)
  const socketRoomMap = new Map<string, string>();

  // ─── Connection ─────────────────────────────────────────────────────────

  io.on('connection', (socket: Socket) => {
    logger.debug('Socket connected', { socketId: socket.id });

    // ─── CREATE ROOM ──────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.CREATE_ROOM, async (data: unknown) => {
      try {
        const payload = createRoomSchema.parse(data) as CreateRoomPayload;
        const { room, user } = await roomService.createRoom(socket.id, payload);

        await socket.join(room.id);
        socketRoomMap.set(socket.id, room.id);

        socket.emit(SERVER_EVENTS.ROOM_CREATED, {
          room,
          user,
          serverTime: Date.now(),
        });

        logger.info('Room created via socket', { roomId: room.id, code: room.code });
      } catch (err) {
        logger.error('CREATE_ROOM error', { err });
        socket.emit(SERVER_EVENTS.ERROR, { code: 'INVALID_PAYLOAD', message: 'Invalid create room data' });
      }
    });

    // ─── JOIN ROOM ────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.JOIN_ROOM, async (data: unknown) => {
      try {
        const payload = joinRoomSchema.parse(data) as JoinRoomPayload;
        const result = await roomService.joinRoom(socket.id, payload);

        if ('error' in result) {
          socket.emit(SERVER_EVENTS.ERROR, { code: result.error, message: result.error });
          return;
        }

        const { room, user } = result;
        await socket.join(room.id);
        socketRoomMap.set(socket.id, room.id);

        // Tell the joiner about the room
        socket.emit(SERVER_EVENTS.ROOM_JOINED, {
          room,
          user,
          serverTime: Date.now(),
        });

        // Only notify others for fresh code-based joins.
        // roomId-based joins are silent reconnects (service-worker restart) —
        // suppress the USER_JOINED toast so it doesn't spam other users.
        if (!payload.roomId) {
          socket.to(room.id).emit(SERVER_EVENTS.USER_JOINED, {
            user,
            room,
          });
        }

        // Send current room state to the new joiner for sync
        socket.emit(SERVER_EVENTS.ROOM_STATE, {
          room,
          serverTime: Date.now(),
        });

        logger.info('User joined room', { roomId: room.id, userId: socket.id, userName: user.name });
      } catch (err) {
        logger.error('JOIN_ROOM error', { err });
        socket.emit(SERVER_EVENTS.ERROR, { code: 'INVALID_PAYLOAD', message: 'Invalid join room data' });
      }
    });

    // ─── LEAVE ROOM ───────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.LEAVE_ROOM, async () => {
      await handleLeave(socket, socketRoomMap, io, rateLimiter);
    });

    // ─── PLAY ─────────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.PLAY, async (data: unknown) => {
      if (!rateLimiter.isAllowed(socket.id, CLIENT_EVENTS.PLAY)) return;
      try {
        const payload = syncEventSchema.parse(data) as PlayPayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          isPlaying: true,
          currentTime: payload.currentTime ?? 0,
          updatedBy: socket.id,
          isAdPlaying: false,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'PLAY',
        });
      } catch (err) {
        logger.error('PLAY error', { err });
      }
    });

    // ─── PAUSE ────────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.PAUSE, async (data: unknown) => {
      if (!rateLimiter.isAllowed(socket.id, CLIENT_EVENTS.PAUSE)) return;
      try {
        const payload = syncEventSchema.parse(data) as PausePayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          isPlaying: false,
          currentTime: payload.currentTime ?? 0,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'PAUSE',
        });
      } catch (err) {
        logger.error('PAUSE error', { err });
      }
    });

    // ─── SEEK ─────────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.SEEK, async (data: unknown) => {
      if (!rateLimiter.isAllowed(socket.id, CLIENT_EVENTS.SEEK)) return;
      try {
        const payload = syncEventSchema.parse(data) as SeekPayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          currentTime: payload.currentTime ?? 0,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'SEEK',
        });
      } catch (err) {
        logger.error('SEEK error', { err });
      }
    });

    // ─── VIDEO CHANGE ─────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.VIDEO_CHANGE, async (data: unknown) => {
      if (!rateLimiter.isAllowed(socket.id, CLIENT_EVENTS.VIDEO_CHANGE)) return;
      try {
        const payload = syncEventSchema.parse(data) as VideoChangePayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          videoId: payload.videoId,
          videoUrl: payload.videoUrl,
          currentTime: 0,
          isPlaying: false,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'VIDEO_CHANGE',
        });
      } catch (err) {
        logger.error('VIDEO_CHANGE error', { err });
      }
    });

    // ─── AD START ─────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.AD_START, async (data: unknown) => {
      try {
        const payload = syncEventSchema.parse(data) as AdStartPayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          isAdPlaying: true,
          isPlaying: false,
          currentTime: payload.currentTime ?? 0,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'AD_START',
        });
      } catch (err) {
        logger.error('AD_START error', { err });
      }
    });

    // ─── AD END ───────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.AD_END, async (data: unknown) => {
      try {
        const payload = syncEventSchema.parse(data) as AdEndPayload;
        const room = await roomService.updateVideoState(payload.roomId, {
          isAdPlaying: false,
          isPlaying: true,
          currentTime: payload.resumeTime ?? 0,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'AD_END',
        });
      } catch (err) {
        logger.error('AD_END error', { err });
      }
    });

    // ─── PLAYBACK RATE CHANGE ─────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.PLAYBACK_RATE_CHANGE, async (data: unknown) => {
      if (!rateLimiter.isAllowed(socket.id, CLIENT_EVENTS.PLAYBACK_RATE_CHANGE)) return;
      try {
        const payload = syncEventSchema.parse(data);
        const rate = payload.playbackRate ?? 1;
        const room = await roomService.updateVideoState(payload.roomId, {
          playbackRate: rate,
          currentTime: payload.currentTime ?? 0,
          updatedBy: socket.id,
        });
        if (!room) return;

        socket.to(payload.roomId).emit(SERVER_EVENTS.SYNC_UPDATE, {
          videoState: room.videoState,
          serverTime: Date.now(),
          triggeredBy: socket.id,
          triggeredByName: payload.userName,
          action: 'PLAYBACK_RATE_CHANGE',
        });
        logger.info('Playback rate changed', { roomId: payload.roomId, rate });
      } catch (err) {
        logger.error('PLAYBACK_RATE_CHANGE error', { err });
      }
    });

    // ─── LOCK CONTROLS ────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.LOCK_CONTROLS, async (data: unknown) => {
      try {
        const { roomId, locked } = data as { roomId: string; locked: boolean };
        const room = await roomService.toggleControls(roomId, socket.id, locked);
        if (!room) return;

        io.to(roomId).emit(SERVER_EVENTS.CONTROLS_CHANGED, { roomId, locked, room });
        logger.info('Controls changed', { roomId, locked, by: socket.id });
      } catch (err) {
        logger.error('LOCK_CONTROLS error', { err });
      }
    });

    // ─── SYNC STATE (pull current state) ──────────────────────────────────

    socket.on(CLIENT_EVENTS.SYNC_STATE, async (data: unknown) => {
      try {
        const { roomId } = data as { roomId: string };
        const room = await roomService.getRoom(roomId);
        if (!room) return;
        socket.emit(SERVER_EVENTS.ROOM_STATE, { room, serverTime: Date.now() });
      } catch (err) {
        logger.error('SYNC_STATE error', { err });
      }
    });

    // ─── PING ─────────────────────────────────────────────────────────────

    socket.on(CLIENT_EVENTS.PING, (data: { clientTime: number }) => {
      socket.emit(SERVER_EVENTS.PONG, {
        clientTime: data.clientTime,
        serverTime: Date.now(),
      });
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      logger.debug('Socket disconnected', { socketId: socket.id, reason });
      await handleLeave(socket, socketRoomMap, io, rateLimiter);
    });
  });

  return io;
}

// ─── Shared leave handler ─────────────────────────────────────────────────────

async function handleLeave(
  socket: Socket,
  socketRoomMap: Map<string, string>,
  io: SocketIOServer,
  rateLimiter: SocketRateLimiter,
): Promise<void> {
  const roomId = socketRoomMap.get(socket.id);
  if (!roomId) return;

  socketRoomMap.delete(socket.id);
  rateLimiter.cleanup(socket.id);

  const leavingUser = (await roomService.getRoom(roomId))?.users.find((u) => u.id === socket.id);
  const { room, wasHost, newHostId } = await roomService.leaveRoom(socket.id, roomId);

  await socket.leave(roomId);

  if (room) {
    io.to(roomId).emit(SERVER_EVENTS.USER_LEFT, {
      userId: socket.id,
      userName: leavingUser?.name ?? 'Unknown',
      newHostId,
      room,
    });

    if (wasHost && newHostId) {
      io.to(roomId).emit(SERVER_EVENTS.HOST_CHANGED, {
        newHostId,
        newHostName: room.users.find((u) => u.id === newHostId)?.name ?? 'Unknown',
        room,
      });
    }
  }

  logger.info('User left room', { roomId, userId: socket.id, wasHost });
}
