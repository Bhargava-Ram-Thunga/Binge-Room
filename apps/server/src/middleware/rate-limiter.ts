import type { Socket } from 'socket.io';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Per-socket event rate limiter.
 * Prevents a single client from flooding the server with sync events.
 */
export class SocketRateLimiter {
  private lastEventTime = new Map<string, number>();
  private eventCounts = new Map<string, number>();

  isAllowed(socketId: string, event: string): boolean {
    const key = `${socketId}:${event}`;
    const now = Date.now();
    const last = this.lastEventTime.get(key) ?? 0;

    if (now - last < config.socketEventRateLimitMs) {
      const count = (this.eventCounts.get(key) ?? 0) + 1;
      this.eventCounts.set(key, count);
      if (count > 5) {
        logger.warn('Socket rate limit exceeded', { socketId, event });
      }
      return false;
    }

    this.lastEventTime.set(key, now);
    this.eventCounts.delete(key);
    return true;
  }

  cleanup(socketId: string): void {
    for (const key of this.lastEventTime.keys()) {
      if (key.startsWith(socketId)) {
        this.lastEventTime.delete(key);
        this.eventCounts.delete(key);
      }
    }
  }
}
