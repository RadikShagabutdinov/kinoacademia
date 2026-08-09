import type {
  AdminPersonDto,
  PersonDossierDto,
  PersonDto,
  RaceCode,
  RoleCode,
} from '@kinoacademia/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { persons, users } from '../../db/schema';

export type PersonRow = {
  id: string;
  userId: string | null;
  displayName: string;
  raceCode: RaceCode;
  roleCode: RoleCode;
  age: number | null;
  isOpen: boolean;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const toRow = (row: typeof persons.$inferSelect): PersonRow => ({
  id: row.id,
  userId: row.userId ?? null,
  displayName: row.displayName,
  raceCode: row.raceCode as RaceCode,
  roleCode: row.roleCode as RoleCode,
  age: row.age ?? null,
  isOpen: row.isOpen,
  closedAt: row.closedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Без расы: она скрытая игровая информация и уходит только в админских ответах. */
export const toPersonDto = (row: PersonRow, isStar?: boolean): PersonDto => ({
  ...(isStar !== undefined && { isStar }),
  id: row.id,
  userId: row.userId,
  displayName: row.displayName,
  roleCode: row.roleCode,
  age: row.age,
  isOpen: row.isOpen,
  closedAt: row.closedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toAdminPersonDto = (row: PersonRow, isStar?: boolean): AdminPersonDto => ({
  ...toPersonDto(row, isStar),
  raceCode: row.raceCode,
});

export type ListPersonsFilter = {
  isOpen?: boolean;
  userId?: string;
};

export const listPersons = async (filter: ListPersonsFilter = {}): Promise<PersonRow[]> => {
  const conditions = [];

  if (filter.isOpen !== undefined) {
    conditions.push(eq(persons.isOpen, filter.isOpen));
  }
  if (filter.userId !== undefined) {
    conditions.push(eq(persons.userId, filter.userId));
  }

  const rows = await db
    .select()
    .from(persons)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(persons.createdAt);

  return rows.map(toRow);
};

export const findPersonById = async (id: string): Promise<PersonRow | null> => {
  const rows = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export const findPersonDossier = async (id: string): Promise<PersonDossierDto | null> => {
  const rows = await db
    .select({
      person: persons,
      user: {
        id: users.id,
        login: users.login,
        roleCode: users.roleCode,
        isActive: users.isActive,
      },
    })
    .from(persons)
    .leftJoin(users, eq(persons.userId, users.id))
    .where(eq(persons.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const personRow = toRow(row.person);

  return {
    ...toAdminPersonDto(personRow),
    user: row.user?.id
      ? {
          id: row.user.id,
          login: row.user.login,
          roleCode: row.user.roleCode as RoleCode,
          isActive: row.user.isActive,
        }
      : null,
  };
};

export const findOpenPersonByUserId = async (userId: string): Promise<PersonRow | null> => {
  const rows = await db
    .select()
    .from(persons)
    .where(and(eq(persons.userId, userId), eq(persons.isOpen, true)))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export type CreatePersonData = {
  userId?: string | null;
  displayName: string;
  raceCode: RaceCode;
  roleCode: RoleCode;
  age?: number | null;
};

export const createPerson = async (data: CreatePersonData): Promise<PersonRow> => {
  const rows = await db
    .insert(persons)
    .values({
      userId: data.userId ?? null,
      displayName: data.displayName,
      raceCode: data.raceCode,
      roleCode: data.roleCode,
      age: data.age ?? null,
      isOpen: true,
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error('Failed to create person');
  return toRow(row);
};

export type UpdatePersonData = {
  userId?: string | null | undefined;
  displayName?: string | undefined;
  raceCode?: RaceCode | undefined;
  roleCode?: RoleCode | undefined;
  age?: number | null | undefined;
  isOpen?: boolean | undefined;
  closedAt?: Date | null | undefined;
};

export const updatePerson = async (
  id: string,
  data: UpdatePersonData,
): Promise<PersonRow | null> => {
  const rows = await db
    .update(persons)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(eq(persons.id, id))
    .returning();

  return rows[0] ? toRow(rows[0]) : null;
};

export const closePerson = async (id: string): Promise<PersonRow | null> => {
  const rows = await db
    .update(persons)
    .set({
      isOpen: false,
      userId: null,
      closedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(persons.id, id), eq(persons.isOpen, true)))
    .returning();

  return rows[0] ? toRow(rows[0]) : null;
};

export const openPerson = async (id: string): Promise<PersonRow | null> => {
  const rows = await db
    .update(persons)
    .set({
      isOpen: true,
      closedAt: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(persons.id, id), eq(persons.isOpen, false)))
    .returning();

  return rows[0] ? toRow(rows[0]) : null;
};
