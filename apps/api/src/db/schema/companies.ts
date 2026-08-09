import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { branches } from './lookups';
import { persons } from './persons';

export const companies = pgTable(
  'companies',
  {
    id: id(),
    name: text().notNull(),
    branchCode: text()
      .notNull()
      .references(() => branches.code),
    headPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    isSystem: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('companies_name_unique').on(t.name),
    uniqueIndex('companies_system_unique').on(t.isSystem).where(sql`is_system = true`),
  ],
);
