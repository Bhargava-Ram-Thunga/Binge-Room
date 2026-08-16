import Fastify, { type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { config } from '@huddly/config';
import {
  validateEventWithPayload,
  PROTOCOL_VERSION,
  type EventEnvelope,
  type RoomStateSnapshotPayload,
} from '@huddly/protocol';

export interface AuthenticatedClientContext {
  userId: string;
  displayName: string;
  roomId: string;
  memberId: string;
  role: 'HOST' | 'PARTICIPANT';
}

export interface GatewayState {
  roomSockets: Map<string, Set<WebSocket>>;
  socketContexts: Map<WebSocket, AuthenticatedClientContext>;
  socketRateLimits: Map<WebSocket, { count: number; resetAt: number }>;
  roomRevisions: Map<string, number>;
}

export async function buildGatewayApp(opts?: { redisPubSub?: Redis; redisState?: Redis }) {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Register WebSocket plugin with 64KB maxPayload limit to prevent large frame attacks
  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024,
    },
  });

  const redisPubSub = opts?.redisPubSub || new Redis(config.REDIS_PUBSUB_URL);
  const redisSub = redisPubSub.duplicate();
  const redisState = opts?.redisState || new Redis(config.REDIS_STATE_URL);

  const state: GatewayState = {
    roomSockets: new Map(),
    socketContexts: new Map(),
    socketRateLimits: new Map(),
    roomRevisions: new Map(),
  };

  // Listen for incoming pub/sub messages across gateway nodes
  redisSub.on('message', (channel: string, messageStr: string) => {
    const roomId = channel.replace(/^room:/, '');
    const sockets = state.roomSockets.get(roomId);
    if (!sockets || sockets.size === 0) return;

    for (const socket of sockets) {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(messageStr);
      }
    }
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // WebSocket Ingress
  app.get('/ws', { websocket: true }, async (socket: WebSocket, req: FastifyRequest) => {
    const hostHeader = (req.headers['host'] as string) || 'localhost';
    const url = new URL(req.url, `http://${hostHeader}`);
    const ticket = url.searchParams.get('ticket');

    if (!ticket) {
      socket.close(4401, 'Unauthorized: Missing connection ticket');
      return;
    }

    // Atomic ticket consumption (GETDEL) from Redis State instance
    let ticketJson: string | null;
    try {
      ticketJson = await redisState.getdel(`ticket:${ticket}`);
    } catch {
      ticketJson = null;
    }

    if (!ticketJson) {
      socket.close(4401, 'Unauthorized: Invalid or expired connection ticket');
      return;
    }

    let clientCtx: AuthenticatedClientContext;
    try {
      clientCtx = JSON.parse(ticketJson);
    } catch {
      socket.close(4400, 'Invalid ticket payload structure');
      return;
    }

    const { roomId } = clientCtx;

    // Register socket
    if (!state.roomSockets.has(roomId)) {
      state.roomSockets.set(roomId, new Set());
      await redisSub.subscribe(`room:${roomId}`);
    }
    state.roomSockets.get(roomId)!.add(socket);
    state.socketContexts.set(socket, clientCtx);

    // Send initial snapshot on connect matching @huddly/protocol specification
    const currentRev = state.roomRevisions.get(roomId) || 0;
    const snapshotPayload: RoomStateSnapshotPayload = {
      room: {
        roomId,
        name: 'Watch Room',
        status: 'ACTIVE',
        hostId: clientCtx.userId,
        revision: currentRev,
      },
      members: [
        {
          memberId: clientCtx.memberId,
          userId: clientCtx.userId,
          displayName: clientCtx.displayName,
          role: clientCtx.role,
          presence: 'ONLINE',
        },
      ],
      playback: {
        mediaId: 'default-media',
        mediaUrl: 'https://huddly.app/media/placeholder.mp4',
        position: 0.0,
        playing: false,
        playbackRate: 1.0,
        revision: currentRev,
        serverTimestamp: Date.now(),
      },
      chat: {
        messages: [],
      },
    };

    const snapshotEnvelope: EventEnvelope<RoomStateSnapshotPayload> = {
      protocolVersion: PROTOCOL_VERSION,
      eventId: randomUUID(),
      eventType: 'ROOM_STATE_SNAPSHOT',
      roomId,
      actorId: null,
      revision: currentRev,
      serverTimestamp: Date.now(),
      payload: snapshotPayload,
    };
    socket.send(JSON.stringify(snapshotEnvelope));

    // Handle Incoming WebSocket Messages
    socket.on('message', async (data: Buffer | string) => {
      const receiveTime = Date.now();

      // Per-socket sliding window rate limiting (max 25 msgs/second)
      let limiter = state.socketRateLimits.get(socket);
      if (!limiter || receiveTime > limiter.resetAt) {
        limiter = { count: 1, resetAt: receiveTime + 1000 };
        state.socketRateLimits.set(socket, limiter);
      } else {
        limiter.count += 1;
        if (limiter.count > 25) {
          socket.send(
            JSON.stringify({
              error: 'RATE_LIMITED',
              message: 'Rate limit exceeded: maximum 25 events per second.',
            }),
          );
          return;
        }
      }

      let rawMsg: Record<string, unknown>;
      try {
        rawMsg = JSON.parse(data.toString());
      } catch {
        socket.send(
          JSON.stringify({
            error: 'INVALID_JSON',
            message: 'Malformed JSON message payload',
          }),
        );
        return;
      }

      // Handle NTP-Lite Clock Sync Probe
      if (rawMsg['type'] === 'CLOCK_SYNC_PROBE') {
        const reply = {
          type: 'CLOCK_SYNC_RESPONSE',
          t1: rawMsg['t1'],
          t2: receiveTime,
          t3: Date.now(),
        };
        socket.send(JSON.stringify(reply));
        return;
      }

      // Validate Protocol v1 Envelope & Payload
      const validation = validateEventWithPayload(rawMsg);
      if (!validation.ok) {
        socket.send(
          JSON.stringify({
            error: 'PROTOCOL_VALIDATION_FAILED',
            errors: validation.errors,
          }),
        );
        return;
      }

      const env = validation.value;

      // Role check for playback mutations: Only HOST can mutate playback by default
      if (env.eventType.startsWith('PLAYBACK_') && clientCtx.role !== 'HOST') {
        socket.send(
          JSON.stringify({
            error: 'FORBIDDEN',
            message: 'Only the room host can control video playback',
          }),
        );
        return;
      }

      // Assign monotonic revision
      const nextRev = (state.roomRevisions.get(roomId) || 0) + 1;
      state.roomRevisions.set(roomId, nextRev);

      const serverEnvelope = {
        ...env,
        eventId: randomUUID(),
        actorId: clientCtx.userId,
        revision: nextRev,
        serverTimestamp: Date.now(),
      };

      // Publish to Redis Pub/Sub for cross-node fanout
      await redisPubSub.publish(`room:${roomId}`, JSON.stringify(serverEnvelope));
    });

    // Cleanup on disconnect
    socket.on('close', async () => {
      state.socketContexts.delete(socket);
      state.socketRateLimits.delete(socket);
      const roomSet = state.roomSockets.get(roomId);
      if (roomSet) {
        roomSet.delete(socket);
        if (roomSet.size === 0) {
          state.roomSockets.delete(roomId);
          await redisSub.unsubscribe(`room:${roomId}`);
        }
      }
    });
  });

  app.addHook('onClose', async () => {
    await redisSub.quit();
    if (!opts?.redisPubSub) await redisPubSub.quit();
    if (!opts?.redisState) await redisState.quit();
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const start = async () => {
    const server = await buildGatewayApp();
    try {
      await server.listen({ port: config.WS_PORT, host: config.HOST });
      server.log.info(
        `[Huddly Realtime Gateway] Server listening on ws://${config.HOST}:${config.WS_PORT}`,
      );
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };
  void start();
}
