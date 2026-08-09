import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id } from './helpers';
import { users } from './users';

export const accessLog = pgTable('access_log', {
  id: id(),
  userId: uuid().references(() => users.id, { onDelete: 'set null' }),
  action: text().notNull(),
  payload: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});

export const auditLog = pgTable('audit_log', {
  id: id(),
  actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  action: text().notNull(),
  entityType: text().notNull(),
  entityId: uuid(),
  payload: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
