import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { redisAdapter } from './adapters/redis.adapter.js';
import { createSocketGateway } from './socket/gateway.js';

async function bootstrap() {
  // ─── Express App ───────────────────────────────────────────────────────────

  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.clientOrigin, credentials: false }));
  app.use(express.json({ limit: '10kb' }));

  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // ─── Health Check ──────────────────────────────────────────────────────────

  app.get('/health', async (_req, res) => {
    const redisOk = await redisAdapter.ping();
    res.json({
      status: redisOk ? 'ok' : 'degraded',
      redis: redisOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── Room Info (for invite links) ──────────────────────────────────────────

  app.get('/api/room/:code', async (req, res) => {
    const { code } = req.params;
    if (!/^[A-Z0-9]{6}$/.test(code.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    // In production this would look up room metadata (non-sensitive) from Redis
    res.json({ code: code.toUpperCase(), message: 'Use the extension to join this room.' });
  });

  // ─── HTTP + Socket.IO Server ───────────────────────────────────────────────

  const httpServer = createServer(app);
  createSocketGateway(httpServer);

  // ─── Redis ────────────────────────────────────────────────────────────────

  try {
    await redisAdapter.connect();
  } catch (err) {
    logger.warn('Redis unavailable, running without persistence', { err });
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  httpServer.listen(config.port, () => {
    logger.info(`Binge-Room server running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });
  });

  // ─── Graceful Shutdown ────────────────────────────────────────────────────

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    httpServer.close(async () => {
      await redisAdapter.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error', { err });
  process.exit(1);
});
