import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",

  // Room settings
  maxRoomUsers: parseInt(process.env.MAX_ROOM_USERS ?? "20", 10),
  roomTtlSeconds: parseInt(process.env.ROOM_TTL_SECONDS ?? "86400", 10), // 24 hours

  // Rate limiting
  rateLimitWindowMs: 60_000,
  rateLimitMax: 100,
  socketEventRateLimitMs: 200, // min ms between sync events per socket

  // Sync
  syncIntervalMs: 5_000,
  driftThresholdMs: 500,
} as const;
