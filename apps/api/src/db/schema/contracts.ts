import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { id, timestamps } from './helpers';
import { contractStatuses } from './lookups';
import { persons } from './persons';
import { scanSets } from './scans';
import { users } from './users';

export const permanentContracts = pgTable('permanent_contracts', {
  id: id(),
  personId: uuid()
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  companyId: uuid()
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  statusCode: text()
    .notNull()
    .references(() => contractStatuses.code),
  startedAt: timestamp({ withTimezone: true }),
  endedAt: timestamp({ withTimezone: true }),
  // Кто запросил расторжение по согласию ('person' | 'company'). Подтвердить
  // или отклонить запрос имеет право только противоположная сторона.
  breakupInitiatedBy: text(),
  scanSetId: uuid().references(() => scanSets.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const temporaryContracts = pgTable(
  'temporary_contracts',
  {
    id: id(),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    statusCode: text()
      .notNull()
      .references(() => contractStatuses.code),
    startedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    breakupInitiatedBy: text(),
    scanSetId: uuid().references(() => scanSets.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('temporary_contracts_person_company_active_unique')
      .on(t.personId, t.companyId)
      .where(sql`ended_at IS NULL`),
  ],
);

export const contractStatusHistory = pgTable('contract_status_history', {
  id: id(),
  contractId: uuid().notNull(),
  contractKind: text().notNull(),
  fromStatusCode: text().references(() => contractStatuses.code),
  toStatusCode: text()
    .notNull()
    .references(() => contractStatuses.code),
  changedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  comment: text(),
  changedAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});
