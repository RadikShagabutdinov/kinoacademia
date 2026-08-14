import type { ContractKind, FilmRole } from '@kinoacademia/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { db } from '../../db/client';
import { companies, filmAssignments, films, persons } from '../../db/schema';

export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export type FilmRow = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FilmWithCompanyRow = FilmRow & { companyName: string };

export type FilmAssignmentRow = {
  id: string;
  filmId: string;
  personId: string;
  role: FilmRole;
  contractId: string | null;
  contractKind: ContractKind | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FilmAssignmentDetailRow = FilmAssignmentRow & { personName: string };

const toFilmRow = (row: typeof films.$inferSelect): FilmRow => ({
  id: row.id,
  companyId: row.companyId,
  title: row.title,
  description: row.description ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toAssignmentRow = (row: typeof filmAssignments.$inferSelect): FilmAssignmentRow => ({
  id: row.id,
  filmId: row.filmId,
  personId: row.personId,
  role: row.role as FilmRole,
  contractId: row.contractId ?? null,
  contractKind: (row.contractKind ?? null) as ContractKind | null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const findFilmById = async (exec: DbExecutor, id: string): Promise<FilmRow | null> => {
  const rows = await exec.select().from(films).where(eq(films.id, id)).limit(1);
  return rows[0] ? toFilmRow(rows[0]) : null;
};

export const insertFilm = async (
  exec: DbExecutor,
  data: { companyId: string; title: string; description?: string | null },
): Promise<FilmRow> => {
  const rows = await exec
    .insert(films)
    .values({
      companyId: data.companyId,
      title: data.title,
      description: data.description ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert film');
  return toFilmRow(row);
};

export const insertAssignment = async (
  exec: DbExecutor,
  data: {
    filmId: string;
    personId: string;
    role: FilmRole;
    contractId?: string | null;
    contractKind?: ContractKind | null;
  },
): Promise<FilmAssignmentRow> => {
  const rows = await exec
    .insert(filmAssignments)
    .values({
      filmId: data.filmId,
      personId: data.personId,
      role: data.role,
      contractId: data.contractId ?? null,
      contractKind: data.contractKind ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert film assignment');
  return toAssignmentRow(row);
};

export const findAssignment = async (
  exec: DbExecutor,
  filmId: string,
  personId: string,
  role: FilmRole,
): Promise<FilmAssignmentRow | null> => {
  const rows = await exec
    .select()
    .from(filmAssignments)
    .where(
      and(
        eq(filmAssignments.filmId, filmId),
        eq(filmAssignments.personId, personId),
        eq(filmAssignments.role, role),
      ),
    )
    .limit(1);
  return rows[0] ? toAssignmentRow(rows[0]) : null;
};

export const findAssignmentById = async (
  exec: DbExecutor,
  id: string,
): Promise<FilmAssignmentRow | null> => {
  const rows = await exec.select().from(filmAssignments).where(eq(filmAssignments.id, id)).limit(1);
  return rows[0] ? toAssignmentRow(rows[0]) : null;
};

export const deleteAssignment = async (exec: DbExecutor, id: string): Promise<void> => {
  await exec.delete(filmAssignments).where(eq(filmAssignments.id, id));
};

export const listAssignmentsByFilm = async (
  exec: DbExecutor,
  filmId: string,
): Promise<FilmAssignmentDetailRow[]> => {
  const rows = await exec
    .select({
      id: filmAssignments.id,
      filmId: filmAssignments.filmId,
      personId: filmAssignments.personId,
      role: filmAssignments.role,
      contractId: filmAssignments.contractId,
      contractKind: filmAssignments.contractKind,
      createdAt: filmAssignments.createdAt,
      updatedAt: filmAssignments.updatedAt,
      personName: persons.displayName,
    })
    .from(filmAssignments)
    .innerJoin(persons, eq(persons.id, filmAssignments.personId))
    .where(eq(filmAssignments.filmId, filmId))
    .orderBy(filmAssignments.createdAt);
  return rows.map((r) => ({
    id: r.id,
    filmId: r.filmId,
    personId: r.personId,
    role: r.role as FilmRole,
    contractId: r.contractId ?? null,
    contractKind: (r.contractKind ?? null) as ContractKind | null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    personName: r.personName,
  }));
};

export const listFilmsByCompany = async (
  exec: DbExecutor,
  companyId: string,
): Promise<FilmWithCompanyRow[]> => {
  const rows = await exec
    .select({ film: films, companyName: companies.name })
    .from(films)
    .innerJoin(companies, eq(companies.id, films.companyId))
    .where(eq(films.companyId, companyId))
    .orderBy(desc(films.createdAt));
  return rows.map((r) => ({ ...toFilmRow(r.film), companyName: r.companyName }));
};

export const listAllFilms = async (exec: DbExecutor = db): Promise<FilmWithCompanyRow[]> => {
  const rows = await exec
    .select({ film: films, companyName: companies.name })
    .from(films)
    .innerJoin(companies, eq(companies.id, films.companyId))
    .orderBy(desc(films.createdAt));
  return rows.map((r) => ({ ...toFilmRow(r.film), companyName: r.companyName }));
};

export const listFilmsByPerson = async (
  exec: DbExecutor,
  personId: string,
): Promise<Array<FilmWithCompanyRow & { role: FilmRole }>> => {
  const rows = await exec
    .select({
      film: films,
      companyName: companies.name,
      role: filmAssignments.role,
    })
    .from(filmAssignments)
    .innerJoin(films, eq(films.id, filmAssignments.filmId))
    .innerJoin(companies, eq(companies.id, films.companyId))
    .where(eq(filmAssignments.personId, personId))
    .orderBy(desc(films.createdAt));
  return rows.map((r) => ({
    ...toFilmRow(r.film),
    companyName: r.companyName,
    role: r.role as FilmRole,
  }));
};
