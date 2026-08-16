import {
  type CreateOscarNominationInput,
  NOMINATION_LABELS,
  NOMINATION_TO_FILM_ROLE,
  OSCAR_NOMINEE_BONUS,
  OSCAR_WIN_COMPANY_BONUS,
  OSCAR_WIN_PERSON_BONUS,
  type OscarDto,
  type OscarNominationDetailDto,
  computeNominationCost,
  isCinemaOnlyNomination,
} from '@kinoacademia/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { persons } from '../../db/schema';
import { findCompanyById } from '../companies/companies-repo';
import * as contractsRepo from '../contracts/contracts-repo';
import * as filmsRepo from '../films/films-repo';
import * as ratingsRepo from '../ratings/ratings-repo';
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
  /**
   * Списывать ли стоимость подачи с бюджета компании-создателя фильма.
   * Роут выставляет `false` для админа — админские подачи служебные и бесплатны,
   * но всё равно учитываются в счётчике для последующих платных подач.
   */
  chargeCompany?: boolean;
};

/**
 * Подача номинации. Стоит компании переменного рейтинга (бюджета) по прогрессивной
 * шкале от числа уже поданных ею номинаций — см. `computeNominationCost`. Рейтинг за
 * подачу никому не начисляется: начисления получают только победители церемонии
 * (см. `awardOscar`).
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

      // Блокируем строку рейтинга до чтения счётчика: иначе две параллельные
      // подачи посчитают одну и ту же стоимость и спишут меньше положенного.
      const rating = await ratingsRepo.findCompanyRatingForUpdate(tx, film.companyId);
      const cost = computeNominationCost(await repo.countCompanyNominations(tx, film.companyId));

      if (input.chargeCompany !== false && cost > 0) {
        if (rating.budget < cost) {
          throw new OscarError(
            'insufficient_budget',
            `Недостаточно бюджета: нужно ${cost}, доступно ${rating.budget}`,
          );
        }
        await ratings.manualCompanyTransaction({
          companyId: film.companyId,
          amount: -cost,
          kind: 'budget',
          mode: 'absolute',
          comment: `Подача номинации: ${NOMINATION_LABELS[nominationCode]}`,
          actorUserId: input.actorUserId,
          exec: tx,
        });
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

export type WithdrawNominationInput = {
  oscarId: string;
  actorUserId: string;
};

/**
 * Отзыв поданной номинации: строка удаляется, а компании возвращается стоимость
 * верхней ступени шкалы — цена последней по счёту номинации. Возврат считается по
 * счётчику, а не по фактически списанному: подача и отзыв подряд компенсируют друг
 * друга при любой глубине шкалы. Победившую номинацию отозвать нельзя.
 */
export const withdrawNomination = async (
  input: WithdrawNominationInput,
): Promise<{ oscarId: string; refunded: number }> => {
  const result = await db.transaction(async (tx) => {
    const current = await repo.findOscarByIdForUpdate(tx, input.oscarId);
    if (!current) throw new OscarError('oscar_not_found', 'Oscar not found');
    if (current.isWinner) {
      throw new OscarError('already_awarded', 'Победившую номинацию отозвать нельзя');
    }

    let companyId: string | null = null;
    let refunded = 0;

    if (current.filmId) {
      const film = await filmsRepo.findFilmById(tx, current.filmId);
      companyId = film?.companyId ?? null;
    }

    if (companyId) {
      await ratingsRepo.findCompanyRatingForUpdate(tx, companyId);
      // В счётчик входит отзываемая номинация, поэтому `-1` даёт цену верхней ступени.
      const count = await repo.countCompanyNominations(tx, companyId);
      refunded = computeNominationCost(count - 1);

      if (refunded > 0) {
        await ratings.manualCompanyTransaction({
          companyId,
          amount: refunded,
          kind: 'budget',
          mode: 'absolute',
          comment: `Отзыв номинации: ${NOMINATION_LABELS[current.nominationCode]}`,
          actorUserId: input.actorUserId,
          exec: tx,
        });
      }
    }

    await repo.deleteOscar(tx, input.oscarId);
    return { row: current, companyId, refunded };
  });

  oscarsEmitter.emit('oscar.withdrawn', {
    oscarId: result.row.id,
    filmId: result.row.filmId,
    personId: result.row.personId,
    companyId: result.companyId,
    nominationCode: result.row.nominationCode,
    isWinner: false,
  });

  return { oscarId: result.row.id, refunded: result.refunded };
};

export type AwardOscarInput = {
  oscarId: string;
  actorUserId: string;
};

/**
 * Присуждение награды. Первое присуждение закрывает номинацию целиком: второго
 * победителя в той же категории быть не может, а все прочие номинанты сразу получают
 * утешительный приз. Внутри одной транзакции:
 *  1. SELECT FOR UPDATE всех строк номинации
 *  2. UPDATE isWinner = true у выбранной строки
 *  3. победителю +OSCAR_WIN_PERSON_BONUS в постоянный рейтинг (kind=oscar)
 *  4. компании, номинировавшей победителя, — отдельные +OSCAR_WIN_COMPANY_BONUS,
 *     но только если у победителя есть действующий контракт с ней
 *  5. каждому проигравшему номинанту +OSCAR_NOMINEE_BONUS
 *
 * Зеркалить начисления персон в постоянный рейтинг их компаний не нужно — это делает
 * сам `ratings.manualPersonTransaction` по постоянному контракту персоны.
 *
 * Закрытая номинация `contribution` присуждается без движений рейтинга: она админская,
 * конкурса в ней нет, начисления админ делает вручную под нужды игры.
 */
export const awardOscar = async (input: AwardOscarInput): Promise<OscarRow> => {
  const result = await db.transaction(async (tx) => {
    const existing = await repo.findOscarById(tx, input.oscarId);
    if (!existing) throw new OscarError('oscar_not_found', 'Oscar not found');

    const nominationCode = existing.nominationCode;
    const label = NOMINATION_LABELS[nominationCode];
    const siblings = await repo.findByNominationForUpdate(tx, nominationCode);

    const current = siblings.find((row) => row.id === input.oscarId);
    if (!current) throw new OscarError('oscar_not_found', 'Oscar not found');
    if (current.isWinner) {
      throw new OscarError('already_awarded', 'Oscar already awarded');
    }
    // Закрытие категории первым победителем — только для конкурсных номинаций:
    // `contribution` админ может вручить нескольким персонажам за игру.
    if (isCinemaOnlyNomination(nominationCode) && siblings.some((row) => row.isWinner)) {
      throw new OscarError(
        'nomination_already_awarded',
        `В номинации «${label}» уже есть победитель`,
      );
    }

    const updated = await repo.setWinner(tx, input.oscarId);
    if (!updated) throw new OscarError('oscar_not_found', 'Oscar disappeared during update');

    let companyId: string | null = null;
    if (current.filmId) {
      const film = await filmsRepo.findFilmById(tx, current.filmId);
      companyId = film?.companyId ?? null;
    }

    if (!isCinemaOnlyNomination(nominationCode)) {
      return { row: updated, companyId };
    }

    if (current.personId) {
      await ratings.manualPersonTransaction({
        personId: current.personId,
        amount: OSCAR_WIN_PERSON_BONUS,
        kind: 'oscar',
        mode: 'absolute',
        comment: `Победа в номинации: ${label}`,
        actorUserId: input.actorUserId,
        exec: tx,
      });
    }

    // Бонус компании-номинатору — только при контракте с победителем; тип контракта
    // и то, действует ли он до конца игры, роли не играет.
    if (companyId && current.personId) {
      const hasContract =
        (await contractsRepo.findActivePermanentByPersonCompany(tx, current.personId, companyId)) ??
        (await contractsRepo.findActiveTemporary(tx, current.personId, companyId));
      if (hasContract) {
        await ratings.manualCompanyTransaction({
          companyId,
          amount: OSCAR_WIN_COMPANY_BONUS,
          kind: 'oscar',
          mode: 'absolute',
          comment: `Победа в номинации: ${label}`,
          actorUserId: input.actorUserId,
          exec: tx,
        });
      }
    }

    // Утешительный приз проигравшим — по разу на персону: одну и ту же персону могли
    // номинировать в этой категории сразу несколько компаний.
    const losers = new Set(
      siblings
        .filter((row) => row.id !== current.id && row.personId && row.personId !== current.personId)
        .map((row) => row.personId as string),
    );
    for (const personId of losers) {
      await ratings.manualPersonTransaction({
        personId,
        amount: OSCAR_NOMINEE_BONUS,
        kind: 'oscar',
        mode: 'absolute',
        comment: `Номинация без победы: ${label}`,
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
