import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { races, roles } from './lookups';
import { users } from './users';

export const persons = pgTable(
  'persons',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    displayName: text().notNull(),
    raceCode: text()
      .notNull()
      .references(() => races.code),
    roleCode: text()
      .notNull()
      .references(() => roles.code),
    age: integer(),
    isOpen: boolean().notNull().default(true),
    closedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('persons_user_id_open_unique')
      .on(t.userId)
      .where(sql`${t.isOpen} = true AND ${t.userId} IS NOT NULL`),
  ],
);
