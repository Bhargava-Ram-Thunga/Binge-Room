import Redis from 'ioredis';
import type { Room, VideoState } from '@syncstream/shared-types';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const ROOM_PREFIX = 'room:';
const CODE_INDEX_PREFIX = 'code:';

// ─── In-memory fallback store ─────────────────────────────────────────────────
// Used automatically when Redis is unavailable (e.g. local dev without Docker).
// Data lives only for the process lifetime — rooms are lost on server restart.

class MemoryStore {
  private rooms = new Map<string, Room>();
  private codeIndex = new Map<string, string>(); // code → roomId

  async saveRoom(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
    this.codeIndex.set(room.code, room.id);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async getRoomByCode(code: string): Promise<Room | null> {
    const roomId = this.codeIndex.get(code.toUpperCase());
    return roomId ? (this.rooms.get(roomId) ?? null) : null;
  }

  async deleteRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) this.codeIndex.delete(room.code);
    this.rooms.delete(roomId);
  }

  ping(): boolean { return true; }
}

// ─── RedisAdapter with transparent in-memory fallback ────────────────────────

export class RedisAdapter {
  private client: Redis;
  private isConnected = false;
  private memStore = new MemoryStore();

  constructor() {
    this.client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 3000,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected — using Redis for room persistence');
    });

    this.client.on('error', () => {
      // Suppress repeated error spam; we already warned on connect failure
    });

    this.client.on('close', () => {
      if (this.isConnected) {
        logger.warn('Redis disconnected — falling back to in-memory store');
      }
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  get healthy(): boolean {
    return this.isConnected;
  }

  // ─── Room CRUD — Redis when available, memory otherwise ───────────────────

  async saveRoom(room: Room): Promise<void> {
    if (this.isConnected) {
      try {
        const pipeline = this.client.pipeline();
        pipeline.set(`${ROOM_PREFIX}${room.id}`, JSON.stringify(room), 'EX', config.roomTtlSeconds);
        pipeline.set(`${CODE_INDEX_PREFIX}${room.code}`, room.id, 'EX', config.roomTtlSeconds);
        await pipeline.exec();
        return;
      } catch (err) {
        logger.warn('Redis saveRoom failed, using memory', { err });
      }
    }
    await this.memStore.saveRoom(room);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    if (this.isConnected) {
      try {
        const data = await this.client.get(`${ROOM_PREFIX}${roomId}`);
        if (data) return JSON.parse(data) as Room;
        return null;
      } catch {
        // fall through to memory
      }
    }
    return this.memStore.getRoom(roomId);
  }

  async getRoomByCode(code: string): Promise<Room | null> {
    if (this.isConnected) {
      try {
        const roomId = await this.client.get(`${CODE_INDEX_PREFIX}${code.toUpperCase()}`);
        if (!roomId) return null;
        return this.getRoom(roomId);
      } catch {
        // fall through to memory
      }
    }
    return this.memStore.getRoomByCode(code);
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (this.isConnected) {
      try {
        const room = await this.getRoom(roomId);
        if (room) {
          const pipeline = this.client.pipeline();
          pipeline.del(`${ROOM_PREFIX}${roomId}`);
          pipeline.del(`${CODE_INDEX_PREFIX}${room.code}`);
          await pipeline.exec();
        }
        return;
      } catch {
        // fall through to memory
      }
    }
    await this.memStore.deleteRoom(roomId);
  }

  async updateVideoState(roomId: string, videoState: VideoState): Promise<void> {
    const room = await this.getRoom(roomId);
    if (!room) return;
    room.videoState = videoState;
    room.updatedAt = Date.now();
    await this.saveRoom(room);
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected) return this.memStore.ping();
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try { await this.client.quit(); } catch { /* ignore */ }
  }
}

// Singleton
export const redisAdapter = new RedisAdapter();
