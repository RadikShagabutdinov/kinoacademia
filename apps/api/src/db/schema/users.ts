import { boolean, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { id, timestamps } from './helpers';
import { roles } from './lookups';

export const users = pgTable(
  'users',
  {
    id: id(),
    login: text().notNull(),
    passwordHash: text().notNull(),
    roleCode: text()
      .notNull()
      .references(() => roles.code),
    isActive: boolean().notNull().default(true),
    mustChangePassword: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_login_lower_idx').on(t.login)],
);
