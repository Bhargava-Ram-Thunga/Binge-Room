import { prisma, type Prisma } from '@huddly/database';
import type { FastifyBaseLogger } from 'fastify';

export type AuthAuditEventType =
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_REFRESH_SUCCESS'
  | 'AUTH_REFRESH_FAILURE'
  | 'AUTH_GUEST_CREATED';

export interface AuditParams {
  eventType: AuthAuditEventType;
  actorUserId?: string | null | undefined;
  roomId?: string | null | undefined;
  details?: Record<string, unknown> | undefined;
}

/**
 * Fire-and-forget audit write. Never awaited by the caller in the
 * request path, never throws, never delays or fails the auth response.
 */
export function recordAuthAuditEvent(logger: FastifyBaseLogger, params: AuditParams): void {
  try {
    if (!prisma?.auditEvent?.create) {
      return;
    }
    prisma.auditEvent
      .create({
        data: {
          actorUserId: params.actorUserId ?? null,
          roomId: params.roomId ?? null,
          eventType: params.eventType,
          details: (params.details ?? {}) as Prisma.InputJsonValue,
        },
      })
      .catch((err: unknown) => {
        logger.error({ err, eventType: params.eventType }, 'Failed to record audit event');
      });
  } catch (err: unknown) {
    logger.error({ err, eventType: params.eventType }, 'Failed to record audit event');
  }
}
