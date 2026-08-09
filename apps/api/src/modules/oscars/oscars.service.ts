import {
  type CreateOscarNominationInput,
  NOMINATION_TO_FILM_ROLE,
  OSCAR_WIN_COMPANY_BONUS,
  OSCAR_WIN_PERSON_BONUS,
  type OscarDto,
  type OscarNominationDetailDto,
  isCinemaOnlyNomination,
} from '@kinoacademia/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { persons } from '../../db/schema';
import { findCompanyById } from '../companies/companies-repo';
import * as filmsRepo from '../films/films-repo';
import * as ratings from '../ratings/ratings.service';
import { OscarError } from './errors';
import { oscarsEmitter } from './events';
import * as repo from './oscars-repo';
import type { OscarDetailRow, OscarRow } from './oscars-repo';

export const toOscarDto = (row: OscarRow): OscarDto => ({
  id: row.id,
  filmId: row.filmId,
  personId: row.personId,
  nominationCode: row.nominationCode,
  isWinner: row.isWinner,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toOscarDetailDto = (row: OscarDetailRow): OscarNominationDetailDto => ({
  id: row.id,
  filmId: row.filmId,
  filmTitle: row.filmTitle,
  personId: row.personId,
  personName: row.personName,
  companyId: row.companyId,
  companyName: row.companyName,
  nominationCode: row.nominationCode,
  isWinner: row.isWinner,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type SubmitNominationInput = CreateOscarNominationInput & {
  actorUserId: string;
  /**
   * Разрешить категорию `contribution` (closed). Используется только админом —
   * head/cinema получит 409 closed_nomination.
   */
  allowClosed?: boolean;
};

/**
 * Подача номинации. Рейтинг за неё не начисляется: по правилам игры начисления
 * получают только победители церемонии (см. `awardOscar`).
 */
export const submitNomination = async (input: SubmitNominationInput): Promise<OscarRow> => {
  const { nominationCode, filmId = null, personId = null } = input;
  const isClosed = !isCinemaOnlyNomination(nominationCode);

  if (isClosed && !input.allowClosed) {
    throw new OscarError(
      'closed_nomination',
      'Closed nomination (contribution) is not available for cinema companies',
    );
  }

  if (!personId) {
    throw new OscarError('requires_person', 'personId is required');
  }

  if (!isClosed) {
    if (!filmId) {
      throw new OscarError('requires_film', 'filmId is required for cinema nominations');
    }
  }

  const result = await db.transaction(async (tx) => {
    const personRows = await tx.select().from(persons).where(eq(persons.id, personId)).limit(1);
    if (!personRows[0]) {
      throw new OscarError('person_not_found', 'Person not found');
    }

    if (filmId) {
      const film = await filmsRepo.findFilmById(tx, filmId);
      if (!film) throw new OscarError('film_not_found', 'Film not found');

      const company = await findCompanyById(film.companyId);
      if (!company) throw new OscarError('company_not_found', 'Company not found');
      if (company.branchCode !== 'cinema') {
        throw new OscarError('not_cinema', 'Film company branch must be cinema');
      }

      // Проверяем соответствие роли персонажа в фильме категории номинации.
      const requiredRole = NOMINATION_TO_FILM_ROLE[nominationCode];
      if (requiredRole) {
        const assignment = await filmsRepo.findAssignment(tx, filmId, personId, requiredRole);
        if (!assignment) {
          throw new OscarError(
            'invalid_role_for_nomination',
            `Person must be assigned to film with role "${requiredRole}" for nomination "${nominationCode}"`,
          );
        }
      }
    }

    return repo.insertOscar(tx, {
      filmId,
      personId,
      nominationCode,
    });
  });

  oscarsEmitter.emit('oscar.nominated', {
    oscarId: result.id,
    filmId: result.filmId,
    personId: result.personId,
    companyId: null,
    nominationCode: result.nominationCode,
    isWinner: false,
  });
  return result;
};

export type AwardOscarInput = {
  oscarId: string;
  actorUserId: string;
};

/**
 * Присуждение награды. Идемпотентно: если уже `isWinner=true`, бросает
 * `OscarError('already_awarded')`. Внутри одной транзакции:
 *  1. SELECT FOR UPDATE строки `oscars`
 *  2. UPDATE isWinner = true
 *  3. начисление +OSCAR_WIN_PERSON_BONUS персонажу (kind=oscar)
 *  4. если фильм не закрытой номинации — начисление +OSCAR_WIN_COMPANY_BONUS
 *     компании-создателю фильма
 */
export const awardOscar = async (input: AwardOscarInput): Promise<OscarRow> => {
  const result = await db.transaction(async (tx) => {
    const current = await repo.findOscarByIdForUpdate(tx, input.oscarId);
    if (!current) throw new OscarError('oscar_not_found', 'Oscar not found');
    if (current.isWinner) {
      throw new OscarError('already_awarded', 'Oscar already awarded');
    }

    const updated = await repo.setWinner(tx, input.oscarId);
    if (!updated) throw new OscarError('oscar_not_found', 'Oscar disappeared during update');

    let companyId: string | null = null;
    if (current.filmId) {
      const film = await filmsRepo.findFilmById(tx, current.filmId);
      companyId = film?.companyId ?? null;
    }

    if (current.personId) {
      await ratings.manualPersonTransaction({
        personId: current.personId,
        amount: OSCAR_WIN_PERSON_BONUS,
        kind: 'oscar',
        mode: 'absolute',
        comment: `Победа в номинации: ${current.nominationCode}`,
        actorUserId: input.actorUserId,
        exec: tx,
      });
    }

    // Компании начисляем только за «обычные» (cinema) номинации с фильмом.
    if (companyId && isCinemaOnlyNomination(current.nominationCode)) {
      await ratings.manualCompanyTransaction({
        companyId,
        amount: OSCAR_WIN_COMPANY_BONUS,
        kind: 'oscar',
        mode: 'absolute',
        comment: `Победа в номинации: ${current.nominationCode}`,
        actorUserId: input.actorUserId,
        exec: tx,
      });
    }

    return { row: updated, companyId };
  });

  oscarsEmitter.emit('oscar.awarded', {
    oscarId: result.row.id,
    filmId: result.row.filmId,
    personId: result.row.personId,
    companyId: result.companyId,
    nominationCode: result.row.nominationCode,
    isWinner: true,
  });
  return result.row;
};

export const listAllDetail = () => repo.listAllDetail(db);
export const listByCompanyDetail = (companyId: string) => repo.listByCompanyDetail(db, companyId);
export const listByPersonDetail = (personId: string) => repo.listByPersonDetail(db, personId);
export const listByFilmDetail = (filmId: string) => repo.listByFilmDetail(db, filmId);
export const findOscarById = (id: string) => repo.findOscarById(db, id);
