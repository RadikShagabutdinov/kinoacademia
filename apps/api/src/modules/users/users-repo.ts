import type { RoleCode, UserDto } from '@kinoacademia/shared';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';

export type UserRow = {
  id: string;
  login: string;
  passwordHash: string;
  roleCode: RoleCode;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toRow = (row: typeof users.$inferSelect): UserRow => ({
  id: row.id,
  login: row.login,
  passwordHash: row.passwordHash,
  roleCode: row.roleCode as RoleCode,
  isActive: row.isActive,
  mustChangePassword: row.mustChangePassword,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toUserDto = (row: UserRow): UserDto => ({
  id: row.id,
  login: row.login,
  roleCode: row.roleCode,
  isActive: row.isActive,
  mustChangePassword: row.mustChangePassword,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListUsersFilter = {
  roleCode?: RoleCode;
  isActive?: boolean;
  search?: string;
};

export const listUsers = async (filter: ListUsersFilter = {}): Promise<UserRow[]> => {
  const conditions = [];

  if (filter.roleCode !== undefined) {
    conditions.push(eq(users.roleCode, filter.roleCode));
  }
  if (filter.isActive !== undefined) {
    conditions.push(eq(users.isActive, filter.isActive));
  }
  if (filter.search) {
    conditions.push(ilike(users.login, `%${filter.search}%`));
  }

  const rows = await db
    .select()
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(users.createdAt);

  return rows.map(toRow);
};

export const findUserById = async (id: string): Promise<UserRow | null> => {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export const findUserByLogin = async (login: string): Promise<UserRow | null> => {
  const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export type CreateUserData = {
  login: string;
  passwordHash: string;
  roleCode: RoleCode;
};

export const createUser = async (data: CreateUserData): Promise<UserRow> => {
  const rows = await db
    .insert(users)
    .values({
      login: data.login.toLowerCase(),
      passwordHash: data.passwordHash,
      roleCode: data.roleCode,
      isActive: true,
      mustChangePassword: true,
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error('Failed to create user');
  return toRow(row);
};

export type UpdateUserData = {
  roleCode?: RoleCode;
  isActive?: boolean;
  passwordHash?: string;
  mustChangePassword?: boolean;
};

export const updateUser = async (id: string, data: UpdateUserData): Promise<UserRow | null> => {
  const rows = await db
    .update(users)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, id))
    .returning();

  return rows[0] ? toRow(rows[0]) : null;
};
