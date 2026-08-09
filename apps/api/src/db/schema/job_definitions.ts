import { sql } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';

export const jobDefinitions = pgTable('job_definitions', {
  id: id(),
  key: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  cronExpr: text('cron_expr').notNull(),
  timezone: text().notNull(),
  enabled: boolean().notNull().default(true),
  params: jsonb().notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
});

export type JobDefinitionRow = typeof jobDefinitions.$inferSelect;
export type NewJobDefinitionRow = typeof jobDefinitions.$inferInsert;
