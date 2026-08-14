import type {
  ContractKind,
  CreateFilmAssignmentInput,
  CreateFilmInput,
  FilmAssignmentDetailDto,
  FilmAssignmentDto,
  FilmDto,
  FilmRole,
  FilmWithAssignmentsDto,
} from '@kinoacademia/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { oscars, persons } from '../../db/schema';
import { findCompanyById } from '../companies/companies-repo';
import { FilmError } from './errors';
import * as repo from './films-repo';
import type {
  FilmAssignmentDetailRow,
  FilmAssignmentRow,
  FilmRow,
  FilmWithCompanyRow,
} from './films-repo';

export type CreateFilmServiceInput = CreateFilmInput;
export type CreateFilmAssignmentServiceInput = CreateFilmAssignmentInput;

export const toFilmDto = (row: FilmRow): FilmDto => ({
  id: row.id,
  companyId: row.companyId,
  title: row.title,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toAssignmentDto = (row: {
  id: string;
  filmId: string;
  personId: string;
  role: FilmRole;
  contractId: string | null;
  contractKind: ContractKind | null;
  createdAt: Date;
  updatedAt: Date;
}): FilmAssignmentDto => ({
  id: row.id,
  filmId: row.filmId,
  personId: row.personId,
  role: row.role,
  contractId: row.contractId,
  contractKind: row.contractKind,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toAssignmentDetailDto = (row: FilmAssignmentDetailRow): FilmAssignmentDetailDto => ({
  ...toAssignmentDto(row),
  personName: row.personName,
});

export const toFilmWithAssignmentsDto = (
  film: FilmWithCompanyRow,
  assignments: FilmAssignmentDetailRow[],
): FilmWithAssignmentsDto => ({
  ...toFilmDto(film),
  companyName: film.companyName,
  assignments: assignments.map(toAssignmentDetailDto),
});

const ensureCinemaCompany = async (companyId: string): Promise<void> => {
  const company = await findCompanyById(companyId);
  if (!company) throw new FilmError('company_not_found', 'Company not found');
  if (company.branchCode !== 'cinema') {
    throw new FilmError('not_cinema', 'Company branch must be cinema');
  }
};

export const createFilm = async (input: CreateFilmServiceInput): Promise<FilmRow> => {
  await ensureCinemaCompany(input.companyId);
  return repo.insertFilm(db, {
    companyId: input.companyId,
    title: input.title,
    ...(input.description !== undefined && { description: input.description }),
  });
};

export const addAssignment = async (
  input: CreateFilmAssignmentServiceInput,
): Promise<{ assignment: FilmAssignmentDetailRow; film: FilmRow }> => {
  return db.transaction(async (tx) => {
    const film = await repo.findFilmById(tx, input.filmId);
    if (!film) throw new FilmError('film_not_found', 'Film not found');

    const personRows = await tx
      .select()
      .from(persons)
      .where(eq(persons.id, input.personId))
      .limit(1);
    if (!personRows[0]) {
      throw new FilmError('person_not_found', 'Person not found');
    }

    const existing = await repo.findAssignment(tx, input.filmId, input.personId, input.role);
    if (existing) {
      throw new FilmError(
        'duplicate_assignment',
        'Person already assigned to this film with this role',
      );
    }

    const inserted = await repo.insertAssignment(tx, {
      filmId: input.filmId,
      personId: input.personId,
      role: input.role,
      ...(input.contractId !== undefined && { contractId: input.contractId }),
      ...(input.contractKind !== undefined && { contractKind: input.contractKind }),
    });

    return {
      assignment: { ...inserted, personName: personRows[0].displayName },
      film,
    };
  });
};

export const removeAssignment = async (
  filmId: string,
  assignmentId: string,
): Promise<FilmAssignmentRow> => {
  return db.transaction(async (tx) => {
    const assignment = await repo.findAssignmentById(tx, assignmentId);
    if (!assignment || assignment.filmId !== filmId) {
      throw new FilmError('assignment_not_found', 'Assignment not found');
    }

    // Номинация ссылается на пару (фильм, персонаж): убрав участника, мы бы
    // оставили номинацию без подтверждающего назначения в съёмочной группе.
    const nominated = await tx
      .select({ id: oscars.id })
      .from(oscars)
      .where(and(eq(oscars.filmId, filmId), eq(oscars.personId, assignment.personId)))
      .limit(1);
    if (nominated[0]) {
      throw new FilmError('assignment_nominated', 'Person has an Oscar nomination for this film');
    }

    await repo.deleteAssignment(tx, assignmentId);
    return assignment;
  });
};

export const getFilmWithAssignments = async (
  filmId: string,
): Promise<{ film: FilmWithCompanyRow; assignments: FilmAssignmentDetailRow[] }> => {
  const all = await repo.listAllFilms();
  const film = all.find((f) => f.id === filmId);
  if (!film) throw new FilmError('film_not_found', 'Film not found');
  const assignments = await repo.listAssignmentsByFilm(db, filmId);
  return { film, assignments };
};

export const listCompanyFilms = (companyId: string) => repo.listFilmsByCompany(db, companyId);
export const listAllFilms = () => repo.listAllFilms(db);
export const listFilmsByPerson = (personId: string) => repo.listFilmsByPerson(db, personId);
export const listAssignmentsByFilm = (filmId: string) => repo.listAssignmentsByFilm(db, filmId);
export const findFilmById = (id: string) => repo.findFilmById(db, id);
