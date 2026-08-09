import type { RoleCode } from '@kinoacademia/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';

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

export const findUserByLogin = async (login: string): Promise<UserRow | null> => {
  const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export const findUserById = async (id: string): Promise<UserRow | null> => {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};
