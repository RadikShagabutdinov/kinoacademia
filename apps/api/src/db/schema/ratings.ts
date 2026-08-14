import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { id, timestamps } from './helpers';
import { persons } from './persons';
import { users } from './users';

export const personRatings = pgTable('person_ratings', {
  personId: uuid()
    .primaryKey()
    .references(() => persons.id, { onDelete: 'cascade' }),
  generated: integer().notNull().default(0),
  nowPermanent: integer().notNull().default(0),
  lastPermanent: integer().notNull().default(0),
  base: integer().notNull().default(0),
  randomizer: integer().notNull().default(0),
  systemTopup: integer().notNull().default(0),
  manualTopup: integer().notNull().default(0),
  oscar: integer().notNull().default(0),
  penalties: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});

export const companyRatings = pgTable('company_ratings', {
  companyId: uuid()
    .primaryKey()
    .references(() => companies.id, { onDelete: 'cascade' }),
  budget: integer().notNull().default(0),
  nowPermanent: integer().notNull().default(0),
  lastPermanent: integer().notNull().default(0),
  employeePermanent: integer().notNull().default(0),
  // Учётная величина: какая часть employeePermanent пришла от секретного модификатора
  // через плановые начисления. Отдельным слагаемым рейтинга не является и наружу не отдаётся.
  randomizerCapitalized: integer().notNull().default(0),
  manualTopup: integer().notNull().default(0),
  oscar: integer().notNull().default(0),
  penalties: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
});

export const ratingTransactions = pgTable('rating_transactions', {
  id: id(),
  donorPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
  donorCompanyId: uuid().references(() => companies.id, { onDelete: 'set null' }),
  recipientPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
  recipientCompanyId: uuid().references(() => companies.id, { onDelete: 'set null' }),
  amount: integer().notNull(),
  kind: text().notNull(),
  comment: text(),
  authorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});
