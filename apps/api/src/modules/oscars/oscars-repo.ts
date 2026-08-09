import type { NominationCode } from '@kinoacademia/shared';
import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { db } from '../../db/client';
import { companies, films, oscars, persons } from '../../db/schema';

export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export type OscarRow = {
  id: string;
  filmId: string | null;
  personId: string | null;
  nominationCode: NominationCode;
  isWinner: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type OscarDetailRow = OscarRow & {
  filmTitle: string | null;
  personName: string | null;
  companyId: string | null;
  companyName: string | null;
};

const toRow = (row: typeof oscars.$inferSelect): OscarRow => ({
  id: row.id,
  filmId: row.filmId ?? null,
  personId: row.personId ?? null,
  nominationCode: row.nominationCode as NominationCode,
  isWinner: row.isWinner,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const findOscarById = async (exec: DbExecutor, id: string): Promise<OscarRow | null> => {
  const rows = await exec.select().from(oscars).where(eq(oscars.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

/**
 * Блокирует строку oscars для атомарного присуждения. Используется в `award`
 * внутри транзакции, чтобы повторный вызов на ту же номинацию не успел пройти
 * между чтением и UPDATE.
 */
export const findOscarByIdForUpdate = async (
  exec: DbExecutor,
  id: string,
): Promise<OscarRow | null> => {
  const rows = await exec.select().from(oscars).where(eq(oscars.id, id)).for('update').limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export const insertOscar = async (
  exec: DbExecutor,
  data: {
    filmId: string | null;
    personId: string | null;
    nominationCode: NominationCode;
  },
): Promise<OscarRow> => {
  const rows = await exec
    .insert(oscars)
    .values({
      filmId: data.filmId,
      personId: data.personId,
      nominationCode: data.nominationCode,
      isWinner: false,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert oscar');
  return toRow(row);
};

export const setWinner = async (exec: DbExecutor, id: string): Promise<OscarRow | null> => {
  const rows = await exec
    .update(oscars)
    .set({ isWinner: true, updatedAt: sql`now()` })
    .where(eq(oscars.id, id))
    .returning();
  return rows[0] ? toRow(rows[0]) : null;
};

const detailQuery = (exec: DbExecutor) =>
  exec
    .select({
      id: oscars.id,
      filmId: oscars.filmId,
      personId: oscars.personId,
      nominationCode: oscars.nominationCode,
      isWinner: oscars.isWinner,
      createdAt: oscars.createdAt,
      updatedAt: oscars.updatedAt,
      filmTitle: films.title,
      personName: persons.displayName,
      companyId: films.companyId,
      companyName: companies.name,
    })
    .from(oscars)
    .leftJoin(films, eq(films.id, oscars.filmId))
    .leftJoin(companies, eq(companies.id, films.companyId))
    .leftJoin(persons, eq(persons.id, oscars.personId));

const mapDetail = (r: {
  id: string;
  filmId: string | null;
  personId: string | null;
  nominationCode: string;
  isWinner: boolean;
  createdAt: Date;
  updatedAt: Date;
  filmTitle: string | null;
  personName: string | null;
  companyId: string | null;
  companyName: string | null;
}): OscarDetailRow => ({
  id: r.id,
  filmId: r.filmId ?? null,
  personId: r.personId ?? null,
  nominationCode: r.nominationCode as NominationCode,
  isWinner: r.isWinner,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  filmTitle: r.filmTitle ?? null,
  personName: r.personName ?? null,
  companyId: r.companyId ?? null,
  companyName: r.companyName ?? null,
});

export const listAllDetail = async (exec: DbExecutor = db): Promise<OscarDetailRow[]> => {
  const rows = await detailQuery(exec).orderBy(desc(oscars.createdAt));
  return rows.map(mapDetail);
};

export const listByCompanyDetail = async (
  exec: DbExecutor,
  companyId: string,
): Promise<OscarDetailRow[]> => {
  const rows = await detailQuery(exec)
    .where(eq(films.companyId, companyId))
    .orderBy(desc(oscars.createdAt));
  return rows.map(mapDetail);
};

export const listByPersonDetail = async (
  exec: DbExecutor,
  personId: string,
): Promise<OscarDetailRow[]> => {
  const rows = await detailQuery(exec)
    .where(eq(oscars.personId, personId))
    .orderBy(desc(oscars.createdAt));
  return rows.map(mapDetail);
};

export const listByFilmDetail = async (
  exec: DbExecutor,
  filmId: string,
): Promise<OscarDetailRow[]> => {
  const rows = await detailQuery(exec)
    .where(eq(oscars.filmId, filmId))
    .orderBy(desc(oscars.createdAt));
  return rows.map(mapDetail);
};
