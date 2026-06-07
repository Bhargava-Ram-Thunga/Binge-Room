import type { Room, User, VideoState, CreateRoomPayload, JoinRoomPayload } from '@syncstream/shared-types';
import { generateRoomId, generateRoomCode, sanitizeUsername } from '@syncstream/shared-utils';
import { MAX_ROOM_USERS } from '@syncstream/event-schema';
import { redisAdapter } from '../adapters/redis.adapter.js';
import { logger } from '../utils/logger.js';

export class RoomService {
  // ─── Create Room ────────────────────────────────────────────────────────────

  async createRoom(socketId: string, payload: CreateRoomPayload): Promise<{ room: Room; user: User }> {
    const userId = socketId;
    const userName = sanitizeUsername(payload.userName);

    const user: User = {
      id: userId,
      name: userName,
      isHost: true,
      joinedAt: Date.now(),
      platform: payload.platform,
    };

    const videoState: VideoState = {
      videoId: payload.videoId ?? '',
      videoUrl: payload.videoUrl ?? '',
      currentTime: 0,
      isPlaying: false,
      isAdPlaying: false,
      playbackRate: 1,
      lastUpdated: Date.now(),
      updatedBy: userId,
    };

    const room: Room = {
      id: generateRoomId(),
      code: generateRoomCode(),
      hostId: userId,
      users: [user],
      videoState,
      platform: payload.platform,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      controlsLocked: true,  // default: only host can control playback
    };

    await redisAdapter.saveRoom(room);
    logger.info('Room created', { roomId: room.id, code: room.code, host: userName });

    return { room, user };
  }

  // ─── Join Room ──────────────────────────────────────────────────────────────

  async joinRoom(
    socketId: string,
    payload: JoinRoomPayload,
  ): Promise<{ room: Room; user: User } | { error: string }> {
    let room: Room | null = null;

    if (payload.code) {
      room = await redisAdapter.getRoomByCode(payload.code.toUpperCase());
    } else if (payload.roomId) {
      room = await redisAdapter.getRoom(payload.roomId);
    }

    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.users.length >= MAX_ROOM_USERS) return { error: 'ROOM_FULL' };

    // Prevent duplicate join
    const existing = room.users.find((u) => u.id === socketId);
    if (existing) return { room, user: existing };

    const user: User = {
      id: socketId,
      name: sanitizeUsername(payload.userName),
      isHost: false,
      joinedAt: Date.now(),
      platform: payload.platform,
    };

    room.users.push(user);
    room.updatedAt = Date.now();
    await redisAdapter.saveRoom(room);

    logger.info('User joined room', { roomId: room.id, userId: socketId, userName: user.name });
    return { room, user };
  }

  // ─── Leave Room ─────────────────────────────────────────────────────────────

  async leaveRoom(
    socketId: string,
    roomId: string,
  ): Promise<{ room: Room | null; wasHost: boolean; newHostId: string | null }> {
    const room = await redisAdapter.getRoom(roomId);
    if (!room) return { room: null, wasHost: false, newHostId: null };

    const wasHost = room.hostId === socketId;
    room.users = room.users.filter((u) => u.id !== socketId);

    if (room.users.length === 0) {
      await redisAdapter.deleteRoom(roomId);
      logger.info('Room deleted (empty)', { roomId });
      return { room: null, wasHost, newHostId: null };
    }

    let newHostId: string | null = null;
    if (wasHost && room.users.length > 0) {
      newHostId = room.users[0].id;
      room.hostId = newHostId;
      room.users[0].isHost = true;
      logger.info('Host transferred', { roomId, newHostId });
    }

    room.updatedAt = Date.now();
    await redisAdapter.saveRoom(room);

    return { room, wasHost, newHostId };
  }

  // ─── Update Video State ─────────────────────────────────────────────────────

  async updateVideoState(roomId: string, update: Partial<VideoState>): Promise<Room | null> {
    const room = await redisAdapter.getRoom(roomId);
    if (!room) return null;

    room.videoState = {
      ...room.videoState,
      ...update,
      lastUpdated: Date.now(),
    };
    room.updatedAt = Date.now();
    await redisAdapter.saveRoom(room);
    return room;
  }

  // ─── Get Room ───────────────────────────────────────────────────────────────

  async getRoom(roomId: string): Promise<Room | null> {
    return redisAdapter.getRoom(roomId);
  }

  // ─── Toggle Controls Lock ───────────────────────────────────────────────────

  async toggleControls(roomId: string, hostId: string, locked: boolean): Promise<Room | null> {
    const room = await redisAdapter.getRoom(roomId);
    if (!room) return null;
    if (room.hostId !== hostId) return null; // only host can change this

    room.controlsLocked = locked;
    room.updatedAt = Date.now();
    await redisAdapter.saveRoom(room);
    logger.info('Controls toggled', { roomId, locked });
    return room;
  }

  // ─── Get user's current room ────────────────────────────────────────────────

  async findUserRoom(socketId: string): Promise<string | null> {
    // Note: In production use a reverse index in Redis.
    // For now, the socket gateway tracks this in memory.
    return null;
  }
}

export const roomService = new RoomService();
