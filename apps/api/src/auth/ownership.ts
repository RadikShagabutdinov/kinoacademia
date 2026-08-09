import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { companies, persons } from '../db/schema';

export const ownsPerson = async (
  db: Database,
  userId: string,
  personId: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.userId, userId)))
    .limit(1);
  return rows.length > 0;
};

export const ownsCompany = async (
  db: Database,
  userId: string,
  companyId: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: companies.id })
    .from(companies)
    .innerJoin(persons, eq(persons.id, companies.headPersonId))
    .where(and(eq(companies.id, companyId), eq(persons.userId, userId)))
    .limit(1);
  return rows.length > 0;
};
