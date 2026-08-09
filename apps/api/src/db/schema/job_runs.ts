import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { id } from './helpers';

export const jobRuns = pgTable(
  'job_runs',
  {
    id: id(),
    jobKey: text('job_key').notNull(),
    slot: text().notNull(),
    status: text().notNull(),
    triggeredBy: text('triggered_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().default(sql`now()`),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text(),
    output: jsonb(),
  },
  (t) => [
    uniqueIndex('job_runs_key_slot_uq').on(t.jobKey, t.slot),
    index('job_runs_started_at_idx').on(t.startedAt),
  ],
);

export type JobRunRow = typeof jobRuns.$inferSelect;
export type NewJobRunRow = typeof jobRuns.$inferInsert;
