import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OscarRow } from './oscars-repo';

const oscarRows = new Map<string, OscarRow>();
const films = new Map<string, { id: string; companyId: string }>();
const assignments: Array<{
  filmId: string;
  personId: string;
  role: string;
}> = [];
const persons = new Set<string>();
const personOscarBalance = new Map<string, number>();
const companyOscarBalance = new Map<string, number>();
const companyBudget = new Map<string, number>();

vi.mock('../../db/client', () => {
  const fakeDb = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb(fakeDb),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
  };
  return { db: fakeDb, queryClient: { end: async () => {} } };
});

vi.mock('../../db/schema', () => ({ persons: {} }));

vi.mock('../companies/companies-repo', () => ({
  findCompanyById: async (id: string) => ({
    id,
    name: 'Studio',
    branchCode: 'cinema',
    headPersonId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

vi.mock('../films/films-repo', () => ({
  findFilmById: async (_e: unknown, id: string) => films.get(id) ?? null,
  findAssignment: async (_e: unknown, filmId: string, personId: string, role: string) =>
    assignments.find((a) => a.filmId === filmId && a.personId === personId && a.role === role) ??
    null,
}));

vi.mock('./oscars-repo', () => ({
  findOscarById: async (_e: unknown, id: string) => oscarRows.get(id) ?? null,
  findOscarByIdForUpdate: async (_e: unknown, id: string) => oscarRows.get(id) ?? null,
  insertOscar: async (
    _e: unknown,
    data: { filmId: string | null; personId: string | null; nominationCode: string },
  ) => {
    const row: OscarRow = {
      id: randomUUID(),
      filmId: data.filmId,
      personId: data.personId,
      nominationCode: data.nominationCode as OscarRow['nominationCode'],
      isWinner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    oscarRows.set(row.id, row);
    return row;
  },
  countCompanyNominations: async (_e: unknown, companyId: string) =>
    [...oscarRows.values()].filter((o) => o.filmId && films.get(o.filmId)?.companyId === companyId)
      .length,
  deleteOscar: async (_e: unknown, id: string) => {
    oscarRows.delete(id);
  },
  setWinner: async (_e: unknown, id: string) => {
    const cur = oscarRows.get(id);
    if (!cur) return null;
    const next = { ...cur, isWinner: true, updatedAt: new Date() };
    oscarRows.set(id, next);
    return next;
  },
}));

vi.mock('./events', () => ({
  oscarsEmitter: { emit: vi.fn() },
}));

vi.mock('../ratings/ratings.service', () => ({
  manualPersonTransaction: async (input: { personId: string; amount: number }) => {
    personOscarBalance.set(
      input.personId,
      (personOscarBalance.get(input.personId) ?? 0) + input.amount,
    );
    return { row: {}, tx: {} };
  },
  manualCompanyTransaction: async (input: {
    companyId: string;
    amount: number;
    kind?: string;
  }) => {
    const target = input.kind === 'budget' ? companyBudget : companyOscarBalance;
    target.set(input.companyId, (target.get(input.companyId) ?? 0) + input.amount);
    return { row: {}, tx: {} };
  },
}));

vi.mock('../ratings/ratings-repo', () => ({
  findCompanyRatingForUpdate: async (_e: unknown, companyId: string) => ({
    companyId,
    budget: companyBudget.get(companyId) ?? 0,
  }),
}));

// Замена для drizzle-orm `eq` — используем чтобы persons.select().where()...
// возвращал «персон есть/нет». Подменим db.select прямо в тесте.
import { OSCAR_WIN_COMPANY_BONUS, OSCAR_WIN_PERSON_BONUS } from '@kinoacademia/shared';
import { db } from '../../db/client';
import { OscarError } from './errors';
import * as service from './oscars.service';

const reset = () => {
  oscarRows.clear();
  films.clear();
  assignments.length = 0;
  persons.clear();
  personOscarBalance.clear();
  companyOscarBalance.clear();
  companyBudget.clear();

  // Эмулируем `tx.select().from(persons).where(eq(persons.id, id)).limit(1)`,
  // возвращая запись если personId есть в множестве `persons`.
  (db as unknown as { select: () => unknown }).select = () => {
    let filterId: string | null = null;
    return {
      from: () => ({
        where: (cond: { _id?: string }) => {
          // Гарантируем что вызов where получит специально подготовленный
          // объект из нашего мока eq.
          filterId = cond?._id ?? null;
          return {
            limit: async () => {
              if (!filterId) return [];
              return persons.has(filterId) ? [{ id: filterId, displayName: 'P' }] : [];
            },
          };
        },
      }),
    };
  };
};

vi.mock('drizzle-orm', () => ({
  eq: (_col: unknown, val: string) => ({ _id: val }),
}));

beforeEach(reset);

const ACTOR = randomUUID();

describe('submitNomination', () => {
  /** Компания с фильмом, режиссёром и заданным бюджетом. */
  const seedCompany = (budget: number) => {
    const filmId = randomUUID();
    const companyId = randomUUID();
    const personId = randomUUID();
    films.set(filmId, { id: filmId, companyId });
    persons.add(personId);
    assignments.push({ filmId, personId, role: 'director' });
    companyBudget.set(companyId, budget);
    return { filmId, companyId, personId };
  };

  const submit = (filmId: string, personId: string, chargeCompany = true) =>
    service.submitNomination({
      filmId,
      personId,
      nominationCode: 'best_film',
      actorUserId: ACTOR,
      chargeCompany,
    });

  it('не начисляет рейтинг персонажу за подачу номинации', async () => {
    const { filmId, personId } = seedCompany(1000);

    await submit(filmId, personId);

    expect(personOscarBalance.get(personId)).toBeUndefined();
  });

  it('списывает 0/100/100/200/300 за первые пять номинаций компании', async () => {
    const { filmId, companyId, personId } = seedCompany(1000);
    const spent: number[] = [];

    for (let i = 0; i < 5; i++) {
      const before = companyBudget.get(companyId) ?? 0;
      await submit(filmId, personId);
      spent.push(before - (companyBudget.get(companyId) ?? 0));
    }

    expect(spent).toEqual([0, 100, 100, 200, 300]);
    expect(companyBudget.get(companyId)).toBe(1000 - 700);
  });

  it('отказывает при нехватке бюджета и не создаёт номинацию', async () => {
    const { filmId, companyId, personId } = seedCompany(50);
    await submit(filmId, personId); // первая бесплатна
    const countAfterFirst = oscarRows.size;

    await expect(submit(filmId, personId)).rejects.toMatchObject({
      code: 'insufficient_budget',
    });
    expect(oscarRows.size).toBe(countAfterFirst);
    expect(companyBudget.get(companyId)).toBe(50);
  });

  it('админская подача бесплатна, но учитывается в счётчике', async () => {
    const { filmId, companyId, personId } = seedCompany(1000);

    await submit(filmId, personId, false);
    await submit(filmId, personId, false);
    expect(companyBudget.get(companyId)).toBe(1000);

    // Третья подача — уже платная по счётчику, стоит 100.
    await submit(filmId, personId);
    expect(companyBudget.get(companyId)).toBe(900);
  });

  it('отбивает категорию contribution для head (allowClosed=false)', async () => {
    const personId = randomUUID();
    persons.add(personId);
    await expect(
      service.submitNomination({
        personId,
        nominationCode: 'contribution',
        actorUserId: ACTOR,
      }),
    ).rejects.toBeInstanceOf(OscarError);
  });

  it('пропускает contribution для admin (allowClosed=true)', async () => {
    const personId = randomUUID();
    persons.add(personId);
    const created = await service.submitNomination({
      personId,
      nominationCode: 'contribution',
      actorUserId: ACTOR,
      allowClosed: true,
    });
    expect(created.nominationCode).toBe('contribution');
    expect(personOscarBalance.get(personId)).toBeUndefined();
  });

  it('отказывает при несоответствии роли в фильме категории номинации', async () => {
    const filmId = randomUUID();
    const personId = randomUUID();
    films.set(filmId, { id: filmId, companyId: randomUUID() });
    persons.add(personId);
    assignments.push({ filmId, personId, role: 'cinematographer' });

    await expect(
      service.submitNomination({
        filmId,
        personId,
        nominationCode: 'best_film',
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'invalid_role_for_nomination' });
  });
});

describe('withdrawNomination', () => {
  const seedCompany = (budget: number) => {
    const filmId = randomUUID();
    const companyId = randomUUID();
    const personId = randomUUID();
    films.set(filmId, { id: filmId, companyId });
    persons.add(personId);
    assignments.push({ filmId, personId, role: 'director' });
    companyBudget.set(companyId, budget);
    return { filmId, companyId, personId };
  };

  const submit = (filmId: string, personId: string) =>
    service.submitNomination({
      filmId,
      personId,
      nominationCode: 'best_film',
      actorUserId: ACTOR,
    });

  it('возвращает стоимость верхней ступени и удаляет номинацию', async () => {
    const { filmId, companyId, personId } = seedCompany(1000);
    await submit(filmId, personId);
    await submit(filmId, personId);
    const third = await submit(filmId, personId);
    expect(companyBudget.get(companyId)).toBe(800);

    const { refunded } = await service.withdrawNomination({
      oscarId: third.id,
      actorUserId: ACTOR,
    });

    expect(refunded).toBe(100);
    expect(companyBudget.get(companyId)).toBe(900);
    expect(oscarRows.has(third.id)).toBe(false);
  });

  it('подача и отзыв подряд компенсируют друг друга на любой глубине шкалы', async () => {
    const { filmId, companyId, personId } = seedCompany(1000);
    const created = [];
    for (let i = 0; i < 4; i++) created.push(await submit(filmId, personId));
    expect(companyBudget.get(companyId)).toBe(600);

    for (const row of created.reverse()) {
      await service.withdrawNomination({ oscarId: row.id, actorUserId: ACTOR });
    }

    expect(companyBudget.get(companyId)).toBe(1000);
    expect(oscarRows.size).toBe(0);
  });

  it('победившую номинацию отозвать нельзя', async () => {
    const { filmId, companyId, personId } = seedCompany(1000);
    const created = await submit(filmId, personId);
    await service.awardOscar({ oscarId: created.id, actorUserId: ACTOR });

    await expect(
      service.withdrawNomination({ oscarId: created.id, actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'already_awarded' });
    expect(oscarRows.has(created.id)).toBe(true);
    expect(companyBudget.get(companyId)).toBe(1000);
  });

  it('отзыв contribution проходит без возврата', async () => {
    const personId = randomUUID();
    persons.add(personId);
    const created = await service.submitNomination({
      personId,
      nominationCode: 'contribution',
      actorUserId: ACTOR,
      allowClosed: true,
    });

    const { refunded } = await service.withdrawNomination({
      oscarId: created.id,
      actorUserId: ACTOR,
    });

    expect(refunded).toBe(0);
    expect(oscarRows.size).toBe(0);
  });

  it('несуществующая номинация — oscar_not_found', async () => {
    await expect(
      service.withdrawNomination({ oscarId: randomUUID(), actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'oscar_not_found' });
  });
});

describe('awardOscar', () => {
  const seedNomination = (filmId: string, companyId: string, personId: string) => {
    films.set(filmId, { id: filmId, companyId });
    persons.add(personId);
    assignments.push({ filmId, personId, role: 'director' });
    const oscarId = randomUUID();
    oscarRows.set(oscarId, {
      id: oscarId,
      filmId,
      personId,
      nominationCode: 'best_film',
      isWinner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return oscarId;
  };

  it('начисляет +OSCAR_WIN_PERSON_BONUS персонажу и +OSCAR_WIN_COMPANY_BONUS компании', async () => {
    const filmId = randomUUID();
    const companyId = randomUUID();
    const personId = randomUUID();
    const oscarId = seedNomination(filmId, companyId, personId);

    await service.awardOscar({ oscarId, actorUserId: ACTOR });

    expect(personOscarBalance.get(personId)).toBe(OSCAR_WIN_PERSON_BONUS);
    expect(companyOscarBalance.get(companyId)).toBe(OSCAR_WIN_COMPANY_BONUS);
    expect(oscarRows.get(oscarId)?.isWinner).toBe(true);
  });

  it('повторное присуждение бросает already_awarded', async () => {
    const filmId = randomUUID();
    const companyId = randomUUID();
    const personId = randomUUID();
    const oscarId = seedNomination(filmId, companyId, personId);

    await service.awardOscar({ oscarId, actorUserId: ACTOR });

    await expect(service.awardOscar({ oscarId, actorUserId: ACTOR })).rejects.toMatchObject({
      code: 'already_awarded',
    });
  });

  it('contribution: персонажу начисляется бонус, компании — нет', async () => {
    const personId = randomUUID();
    persons.add(personId);
    const oscarId = randomUUID();
    oscarRows.set(oscarId, {
      id: oscarId,
      filmId: null,
      personId,
      nominationCode: 'contribution',
      isWinner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.awardOscar({ oscarId, actorUserId: ACTOR });

    expect(personOscarBalance.get(personId)).toBe(OSCAR_WIN_PERSON_BONUS);
    expect(companyOscarBalance.size).toBe(0);
  });
});
