import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid().primaryKey().default(sql`gen_random_uuid()`);

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
};
