import { z } from '@hono/zod-openapi';
import { lt, or, sql } from 'drizzle-orm';
import { authSessions } from '../../db/schema';
import type { JobHandler } from '../types';

const ParamsSchema = z.object({}).strict();
type Params = z.infer<typeof ParamsSchema>;

export const cleanupSessionsHandler: JobHandler<Params> = {
  key: 'cleanup_sessions',
  name: 'Очистка просроченных refresh-сессий',
  description: 'Удаляет записи auth_sessions с истёкшим expires_at или отозванные ранее суток.',
  defaultCron: '0 3 * * *',
  defaultTimezone: 'Asia/Yekaterinburg',
  defaultParams: {},
  paramsSchema: ParamsSchema,

  async run(ctx) {
    const { db } = ctx;
    const result = await db
      .delete(authSessions)
      .where(
        or(
          lt(authSessions.expiresAt, sql`now()`),
          lt(authSessions.revokedAt, sql`now() - interval '1 day'`),
        ),
      )
      .returning({ id: authSessions.id });
    return { deleted: result.length };
  },
};
