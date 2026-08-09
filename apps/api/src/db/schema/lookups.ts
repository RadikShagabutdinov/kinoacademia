import { pgTable, text } from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const races = pgTable('races', {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const branches = pgTable('branches', {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const contractStatuses = pgTable('contract_statuses', {
  code: text().primaryKey(),
  name: text().notNull(),
});

export const nominations = pgTable('nominations', {
  code: text().primaryKey(),
  name: text().notNull(),
  description: text(),
});

// Справочник заведён на старте проекта и в бизнес-логике не участвует.
// Оставлен, чтобы не тянуть в миграции удаление таблицы ради пяти строк.
export const contractExist = pgTable('contract_exist', {
  code: text().primaryKey(),
  name: text().notNull(),
});
