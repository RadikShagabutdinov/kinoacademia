import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { companies } from './companies';
import { id, timestamps } from './helpers';
import { nominations } from './lookups';
import { persons } from './persons';

export const films = pgTable('films', {
  id: id(),
  companyId: uuid()
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  description: text(),
  ...timestamps,
});

export const filmAssignments = pgTable('film_assignments', {
  id: id(),
  filmId: uuid()
    .notNull()
    .references(() => films.id, { onDelete: 'cascade' }),
  personId: uuid()
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  contractId: uuid(),
  contractKind: text(),
  ...timestamps,
});

export const oscars = pgTable('oscars', {
  id: id(),
  filmId: uuid().references(() => films.id, { onDelete: 'cascade' }),
  personId: uuid().references(() => persons.id, { onDelete: 'set null' }),
  nominationCode: text()
    .notNull()
    .references(() => nominations.code),
  isWinner: boolean().notNull().default(false),
  ...timestamps,
});
