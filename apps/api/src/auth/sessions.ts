import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import { authSessions } from '../db/schema';
import { refreshTokenTtlSeconds, signRefreshToken } from './jwt';

const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export type SessionContext = {
  userAgent?: string | null;
  ip?: string | null;
};

export type IssuedSession = {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
};

export const issueSession = async (
  db: Database,
  userId: string,
  ctx: SessionContext = {},
): Promise<IssuedSession> => {
  const sessionId = randomUUID();
  const refreshToken = await signRefreshToken(userId, sessionId);
  const expiresAt = new Date(Date.now() + refreshTokenTtlSeconds * 1000);

  await db.insert(authSessions).values({
    id: sessionId,
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt,
    userAgent: ctx.userAgent ?? null,
    ip: ctx.ip ?? null,
  });

  return { sessionId, refreshToken, expiresAt };
};

export const findActiveSession = async (db: Database, sessionId: string, refreshToken: string) => {
  const rows = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.refreshTokenHash, hashRefreshToken(refreshToken)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const revokeSession = async (db: Database, sessionId: string): Promise<void> => {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
};

export const rotateSession = async (
  db: Database,
  sessionId: string,
  userId: string,
  ctx: SessionContext = {},
): Promise<IssuedSession> => {
  await revokeSession(db, sessionId);
  return issueSession(db, userId, ctx);
};
