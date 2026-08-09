import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { id } from './helpers';
import { users } from './users';

export const scanSets = pgTable('scan_sets', {
  id: id(),
  companyId: uuid()
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  caption: text().notNull(),
  createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});

export const scanPages = pgTable(
  'scan_pages',
  {
    id: id(),
    setId: uuid()
      .notNull()
      .references(() => scanSets.id, { onDelete: 'cascade' }),
    orderIdx: integer().notNull(),
    filePath: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    uploadedAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [uniqueIndex('scan_pages_set_order_unique').on(t.setId, t.orderIdx)],
);

export type ScanSetRow = typeof scanSets.$inferSelect;
export type NewScanSetRow = typeof scanSets.$inferInsert;
export type ScanPageRow = typeof scanPages.$inferSelect;
export type NewScanPageRow = typeof scanPages.$inferInsert;
