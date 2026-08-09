import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './helpers';
import { users } from './users';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    userAgent: text(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index('auth_sessions_user_id_idx').on(t.userId)],
);
