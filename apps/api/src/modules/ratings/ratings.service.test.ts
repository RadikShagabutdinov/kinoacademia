import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyRatingRow, PersonRatingRow, RatingTransactionRow } from './ratings-repo';

const personRows = new Map<string, PersonRatingRow>();
const companyRows = new Map<string, CompanyRatingRow>();
const transactions: RatingTransactionRow[] = [];
const personHasContract = new Map<string, boolean>();
/** personId → компания активного постоянного контракта (для переноса рейтинга). */
const personCompany = new Map<string, string>();

vi.mock('../../db/client', () => {
  const fakeDb = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb(fakeDb),
  };
  return { db: fakeDb, queryClient: { end: async () => {} } };
});

vi.mock('../contracts/contracts.service', () => ({
  setPenaltyHook: vi.fn(),
}));

const seedPerson = (overrides: Partial<PersonRatingRow> = {}): PersonRatingRow => {
  const personId = overrides.personId ?? randomUUID();
  const row: PersonRatingRow = {
    personId,
    generated: 0,
    nowPermanent: 0,
    lastPermanent: 0,
    base: 0,
    randomizer: 0,
    systemTopup: 0,
    manualTopup: 0,
    oscar: 0,
    penalties: 0,
    updatedAt: new Date(),
    ...overrides,
  };
  personRows.set(personId, row);
  return row;
};

const seedCompany = (overrides: Partial<CompanyRatingRow> = {}): CompanyRatingRow => {
  const companyId = overrides.companyId ?? randomUUID();
  const row: CompanyRatingRow = {
    companyId,
    budget: 0,
    nowPermanent: 0,
    lastPermanent: 0,
    employeePermanent: 0,
    randomizerCapitalized: 0,
    manualTopup: 0,
    oscar: 0,
    penalties: 0,
    updatedAt: new Date(),
    ...overrides,
  };
  companyRows.set(companyId, row);
  return row;
};

const recomputePersonNow = (row: PersonRatingRow): number =>
  row.base + row.randomizer + row.systemTopup + row.manualTopup + row.oscar - row.penalties;

vi.mock('./ratings-repo', () => ({
  ensurePersonRating: async (_e: unknown, personId: string) => {
    const r = personRows.get(personId) ?? seedPerson({ personId });
    return { ...r };
  },
  ensureCompanyRating: async (_e: unknown, companyId: string) => {
    const r = companyRows.get(companyId) ?? seedCompany({ companyId });
    return { ...r };
  },
  applyPersonDelta: async (_e: unknown, personId: string, delta: Partial<PersonRatingRow>) => {
    const cur = personRows.get(personId) ?? seedPerson({ personId });
    const before = cur.nowPermanent;
    const next: PersonRatingRow = {
      ...cur,
      base: cur.base + (delta.base ?? 0),
      randomizer: cur.randomizer + (delta.randomizer ?? 0),
      systemTopup: cur.systemTopup + (delta.systemTopup ?? 0),
      manualTopup: cur.manualTopup + (delta.manualTopup ?? 0),
      oscar: cur.oscar + (delta.oscar ?? 0),
      penalties: cur.penalties + (delta.penalties ?? 0),
      generated: cur.generated + (delta.generated ?? 0),
      updatedAt: new Date(),
    };
    const touchedPermanent =
      delta.base !== undefined ||
      delta.randomizer !== undefined ||
      delta.systemTopup !== undefined ||
      delta.manualTopup !== undefined ||
      delta.oscar !== undefined ||
      delta.penalties !== undefined;
    if (touchedPermanent) {
      next.lastPermanent = before;
      next.nowPermanent = recomputePersonNow(next);
    }
    personRows.set(personId, next);
    return { ...next };
  },
  applyCompanyDelta: async (_e: unknown, companyId: string, delta: Partial<CompanyRatingRow>) => {
    const cur = companyRows.get(companyId) ?? seedCompany({ companyId });
    const next: CompanyRatingRow = {
      ...cur,
      budget: cur.budget + (delta.budget ?? 0),
      employeePermanent: cur.employeePermanent + (delta.employeePermanent ?? 0),
      randomizerCapitalized: cur.randomizerCapitalized + (delta.randomizerCapitalized ?? 0),
      manualTopup: cur.manualTopup + (delta.manualTopup ?? 0),
      oscar: cur.oscar + (delta.oscar ?? 0),
      penalties: cur.penalties + (delta.penalties ?? 0),
      updatedAt: new Date(),
    };
    const touchedPermanent =
      delta.employeePermanent !== undefined ||
      delta.manualTopup !== undefined ||
      delta.oscar !== undefined ||
      delta.penalties !== undefined;
    if (touchedPermanent) {
      next.lastPermanent = cur.nowPermanent;
      next.nowPermanent = next.employeePermanent + next.manualTopup + next.oscar + next.penalties;
    }
    companyRows.set(companyId, next);
    return { ...next };
  },
  insertTransaction: async (
    _e: unknown,
    data: {
      donorPersonId?: string | null;
      donorCompanyId?: string | null;
      recipientPersonId?: string | null;
      recipientCompanyId?: string | null;
      amount: number;
      kind: RatingTransactionRow['kind'];
      comment?: string | null;
      authorUserId?: string | null;
    },
  ) => {
    const row: RatingTransactionRow = {
      id: randomUUID(),
      donorPersonId: data.donorPersonId ?? null,
      donorCompanyId: data.donorCompanyId ?? null,
      recipientPersonId: data.recipientPersonId ?? null,
      recipientCompanyId: data.recipientCompanyId ?? null,
      amount: data.amount,
      kind: data.kind,
      comment: data.comment ?? null,
      authorUserId: data.authorUserId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    transactions.push(row);
    return { ...row };
  },
  listAllPersonRatings: async () => Array.from(personRows.values()).map((r) => ({ ...r })),
  listAllCompanyRatings: async () => Array.from(companyRows.values()).map((r) => ({ ...r })),
  listCompanyRatingsWithRandomizerCapitalized: async () =>
    Array.from(companyRows.values())
      .filter((r) => r.randomizerCapitalized !== 0)
      .map((r) => ({ ...r })),
  listPersonHistory: async (
    _e: unknown,
    personId: string,
    _limit?: number,
    kind?: RatingTransactionRow['kind'],
    excludeKinds?: RatingTransactionRow['kind'][],
  ) =>
    transactions
      .filter((t) => t.donorPersonId === personId || t.recipientPersonId === personId)
      .filter((t) => (kind ? t.kind === kind : true))
      .filter((t) => !excludeKinds?.includes(t.kind))
      .map((t) => ({ ...t })),
  listCompanyHistory: async (_e: unknown, companyId: string) =>
    transactions
      .filter((t) => t.donorCompanyId === companyId || t.recipientCompanyId === companyId)
      .map((t) => ({ ...t })),
  findActivePermanentByPersonId: async (_e: unknown, personId: string) =>
    personHasContract.get(personId) ?? false,
  findActivePermanentCompanyId: async (_e: unknown, personId: string) =>
    personCompany.get(personId) ?? null,
}));

import * as service from './ratings.service';

const ACTOR = randomUUID();

beforeEach(() => {
  personRows.clear();
  companyRows.clear();
  transactions.length = 0;
  personHasContract.clear();
  personCompany.clear();
});

/** Персонаж на постоянном контракте: его рейтинг капитализируется компанией. */
const hireToCompany = (personId: string, companyId: string): void => {
  personHasContract.set(personId, true);
  personCompany.set(personId, companyId);
};

describe('expressAdmiration', () => {
  it('×1 when neither donor nor recipient is Star', async () => {
    const donor = seedPerson({ generated: 5 });
    const recipient = seedPerson();
    const result = await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 3,
      actorUserId: ACTOR,
    });
    expect(result.donor.generated).toBe(2);
    expect(result.recipient.systemTopup).toBe(3);
    expect(result.tx.kind).toBe('variable_to_permanent');
    expect(result.tx.amount).toBe(3);
  });

  it('×5 when donor is Star (nowPermanent ≥ 1000)', async () => {
    const donor = seedPerson({ generated: 5, base: 1000, nowPermanent: 1000 });
    const recipient = seedPerson();
    const result = await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 2,
      actorUserId: ACTOR,
    });
    expect(result.tx.kind).toBe('star_bonus');
    expect(result.tx.amount).toBe(10);
    expect(result.recipient.systemTopup).toBe(10);
  });

  it('×5 when donor is Star (≥500 + active permanent)', async () => {
    const donor = seedPerson({ generated: 5, base: 500, nowPermanent: 500 });
    personHasContract.set(donor.personId, true);
    const recipient = seedPerson();
    const result = await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 2,
      actorUserId: ACTOR,
    });
    expect(result.tx.amount).toBe(10);
  });

  it('×1 when only the recipient is Star: бонус — свойство отправителя', async () => {
    const donor = seedPerson({ generated: 5 });
    const recipient = seedPerson({ base: 1000, nowPermanent: 1000 });
    const result = await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 2,
      actorUserId: ACTOR,
    });
    expect(result.tx.kind).toBe('variable_to_permanent');
    expect(result.tx.amount).toBe(2);
  });

  it('rejects self-transfer', async () => {
    const donor = seedPerson({ generated: 5 });
    await expect(
      service.expressAdmiration({
        donorPersonId: donor.personId,
        recipientPersonId: donor.personId,
        amount: 1,
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'self_transfer' });
  });

  it('rejects when donor lacks generated', async () => {
    const donor = seedPerson({ generated: 1 });
    const recipient = seedPerson();
    await expect(
      service.expressAdmiration({
        donorPersonId: donor.personId,
        recipientPersonId: recipient.personId,
        amount: 5,
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'insufficient_generated' });
  });

  it('updates lastPermanent to previous nowPermanent on transfer', async () => {
    const donor = seedPerson({ generated: 10 });
    const recipient = seedPerson({ base: 100, nowPermanent: 100 });
    const result = await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 5,
      actorUserId: ACTOR,
    });
    expect(result.recipient.lastPermanent).toBe(100);
    expect(result.recipient.nowPermanent).toBe(105);
  });
});

describe('manualPersonTransaction', () => {
  it('absolute mode adds to manualTopup', async () => {
    const p = seedPerson();
    const result = await service.manualPersonTransaction({
      personId: p.personId,
      amount: 50,
      mode: 'absolute',
      actorUserId: ACTOR,
    });
    expect(result.row.manualTopup).toBe(50);
    expect(result.row.nowPermanent).toBe(50);
    expect(result.tx.kind).toBe('manual');
  });

  it('absolute negative subtracts', async () => {
    const p = seedPerson({ manualTopup: 100, nowPermanent: 100, base: 0 });
    const result = await service.manualPersonTransaction({
      personId: p.personId,
      amount: -30,
      actorUserId: ACTOR,
    });
    expect(result.row.manualTopup).toBe(70);
  });

  it('percent mode computes from nowPermanent', async () => {
    const p = seedPerson({ nowPermanent: 200, base: 200, manualTopup: 0 });
    const result = await service.manualPersonTransaction({
      personId: p.personId,
      amount: 10,
      mode: 'percent',
      actorUserId: ACTOR,
    });
    expect(result.row.manualTopup).toBe(20);
    expect(result.row.nowPermanent).toBe(220);
    expect(result.tx.amount).toBe(20);
  });
});

describe('randomizer', () => {
  it('apply sets randomizer to absolute value (delta-based) and writes tx', async () => {
    const a = seedPerson();
    const b = seedPerson({ randomizer: 10 });
    const updated = await service.randomizerApply({
      values: [
        { personId: a.personId, value: 5 },
        { personId: b.personId, value: -2 },
      ],
      actorUserId: ACTOR,
    });
    expect(updated[0]?.randomizer).toBe(5);
    expect(updated[1]?.randomizer).toBe(-2);
    expect(transactions.filter((t) => t.kind === 'randomizer')).toHaveLength(2);
  });

  it('cancel resets all randomizers to 0', async () => {
    seedPerson({ randomizer: 7, nowPermanent: 7 });
    seedPerson({ randomizer: -3, nowPermanent: -3 });
    seedPerson({ randomizer: 0 });
    const updated = await service.randomizerCancel(ACTOR);
    expect(updated.every((r) => r.randomizer === 0)).toBe(true);
    expect(updated).toHaveLength(2);
  });

  it('rejects duplicate personId in apply payload', async () => {
    const p = seedPerson();
    await expect(
      service.randomizerApply({
        values: [
          { personId: p.personId, value: 1 },
          { personId: p.personId, value: 2 },
        ],
        actorUserId: ACTOR,
      }),
    ).rejects.toMatchObject({ code: 'duplicate_randomizer_target' });
  });
});

describe('секретность рандомайзера', () => {
  it('игровая DTO прячет модификатор внутри базы', () => {
    const row = seedPerson({ base: 100, randomizer: -20, systemTopup: 30, nowPermanent: 110 });
    const dto = service.toPersonRatingDto(row, false);
    expect(dto.base).toBe(80);
    expect(dto).not.toHaveProperty('randomizer');
    expect(dto.base + dto.systemTopup + dto.manualTopup + dto.oscar - dto.penalties).toBe(
      dto.nowPermanent,
    );
  });

  it('админская DTO отдаёт сырую базу и модификатор', () => {
    const row = seedPerson({ base: 100, randomizer: -20, nowPermanent: 80 });
    const dto = service.toPersonRatingAdminDto(row, true);
    expect(dto.base).toBe(100);
    expect(dto.randomizer).toBe(-20);
    expect(dto.isStar).toBe(true);
  });

  it('игровая история не содержит транзакций рандомайзера', async () => {
    const p = seedPerson();
    await service.manualPersonTransaction({
      personId: p.personId,
      amount: 50,
      actorUserId: ACTOR,
    });
    await service.randomizerApply({
      values: [{ personId: p.personId, value: 5 }],
      actorUserId: ACTOR,
    });

    const all = await service.listPersonHistory(p.personId);
    expect(all.some((t) => t.kind === 'randomizer')).toBe(true);

    const forPlayer = await service.listPersonHistoryForPlayer(p.personId);
    expect(forPlayer.some((t) => t.kind === 'randomizer')).toBe(false);
    expect(forPlayer).toHaveLength(1);

    // Явный запрос по скрытому виду отдаёт пустой список, а не ошибку.
    await expect(
      service.listPersonHistoryForPlayer(p.personId, undefined, 'randomizer'),
    ).resolves.toEqual([]);
  });
});

describe('contract break penalty', () => {
  const breakPenalty = (personId: string, companyId: string) =>
    service.applyContractBreakPenalty({
      personId,
      companyId,
      reason: 'unilateral_break_by_person',
    });

  it('обычная персона теряет 25% постоянного рейтинга в пользу компании', async () => {
    const p = seedPerson({ base: 200, nowPermanent: 200 });
    const c = seedCompany({ employeePermanent: 100, nowPermanent: 100 });

    await expect(breakPenalty(p.personId, c.companyId)).resolves.toBe(50);

    const personAfter = personRows.get(p.personId);
    const companyAfter = companyRows.get(c.companyId);
    expect(personAfter?.penalties).toBe(50);
    expect(personAfter?.nowPermanent).toBe(150);
    expect(companyAfter?.penalties).toBe(50);
    // Контракт к моменту штрафа уже разорван, поэтому падение рейтинга персонажа
    // не тянет капитализацию вниз — компания получает только сам штраф.
    expect(companyAfter?.employeePermanent).toBe(100);
    expect(companyAfter?.nowPermanent).toBe(150);
    expect(companyAfter?.lastPermanent).toBe(100);
    expect(transactions.find((t) => t.kind === 'penalty')).toMatchObject({
      donorPersonId: p.personId,
      recipientCompanyId: c.companyId,
      amount: 50,
    });
  });

  it('рандомайзер в базу штрафа не входит', async () => {
    const p = seedPerson({ base: 200, randomizer: 100, nowPermanent: 300 });
    const c = seedCompany();

    // 25% считаются от 200, а не от 300.
    await expect(breakPenalty(p.personId, c.companyId)).resolves.toBe(50);
    expect(personRows.get(p.personId)?.penalties).toBe(50);
  });

  it('Звезда теряет 50% постоянного рейтинга', async () => {
    // Порог Звезды «с контрактом» — 500: разрываемый контракт на момент штрафа
    // ещё считается действующим.
    const p = seedPerson({ base: 600, nowPermanent: 600 });
    const c = seedCompany();

    await expect(breakPenalty(p.personId, c.companyId)).resolves.toBe(300);
    expect(personRows.get(p.personId)?.penalties).toBe(300);
    expect(companyRows.get(c.companyId)?.penalties).toBe(300);
  });

  it('при неположительном постоянном рейтинге штраф не начисляется', async () => {
    const p = seedPerson({ base: 100, penalties: 100, nowPermanent: 0 });
    const c = seedCompany();

    await expect(breakPenalty(p.personId, c.companyId)).resolves.toBe(0);
    expect(personRows.get(p.personId)?.penalties).toBe(100);
    expect(transactions.some((t) => t.kind === 'penalty')).toBe(false);
  });
});

describe('перенос постоянного рейтинга сотрудника в компанию', () => {
  it('начисление сотруднику сразу двигает постоянный рейтинг компании', async () => {
    const c = seedCompany({ employeePermanent: 40, nowPermanent: 40 });
    const p = seedPerson({ base: 10, nowPermanent: 10 });
    hireToCompany(p.personId, c.companyId);

    await service.manualPersonTransaction({
      personId: p.personId,
      amount: 25,
      actorUserId: ACTOR,
    });

    const companyAfter = companyRows.get(c.companyId);
    expect(companyAfter?.employeePermanent).toBe(65);
    expect(companyAfter?.nowPermanent).toBe(65);
    expect(companyAfter?.lastPermanent).toBe(40);
    expect(transactions.find((t) => t.recipientCompanyId === c.companyId)).toMatchObject({
      kind: 'generated',
      amount: 25,
    });
  });

  it('списание сотруднику уменьшает рейтинг компании на ту же величину', async () => {
    const c = seedCompany({ employeePermanent: 100, nowPermanent: 100 });
    const p = seedPerson({ manualTopup: 50, nowPermanent: 50 });
    hireToCompany(p.personId, c.companyId);

    await service.manualPersonTransaction({
      personId: p.personId,
      amount: -20,
      actorUserId: ACTOR,
    });

    expect(companyRows.get(c.companyId)?.nowPermanent).toBe(80);
  });

  it('рандомайзер сотрудника отражается на компании сразу, отмена — откатывает', async () => {
    const c = seedCompany();
    const p = seedPerson();
    hireToCompany(p.personId, c.companyId);

    await service.randomizerApply({
      values: [{ personId: p.personId, value: 15 }],
      actorUserId: ACTOR,
    });
    expect(companyRows.get(c.companyId)?.nowPermanent).toBe(15);

    await service.randomizerCancel(ACTOR);
    expect(companyRows.get(c.companyId)?.nowPermanent).toBe(0);
  });

  it('персонаж без постоянного контракта компанию не задевает', async () => {
    const c = seedCompany({ employeePermanent: 10, nowPermanent: 10 });
    const p = seedPerson();

    await service.manualPersonTransaction({
      personId: p.personId,
      amount: 99,
      actorUserId: ACTOR,
    });

    expect(companyRows.get(c.companyId)?.nowPermanent).toBe(10);
  });

  it('перевод восхищения меняет только постоянный рейтинг: донор компанию не тянет', async () => {
    const donorCompany = seedCompany({ employeePermanent: 30, nowPermanent: 30 });
    const donor = seedPerson({ generated: 10 });
    hireToCompany(donor.personId, donorCompany.companyId);
    const recipient = seedPerson();

    await service.expressAdmiration({
      donorPersonId: donor.personId,
      recipientPersonId: recipient.personId,
      amount: 4,
      actorUserId: ACTOR,
    });

    expect(companyRows.get(donorCompany.companyId)?.nowPermanent).toBe(30);
  });
});

describe('applyCapitalization', () => {
  it('накопительно прибавляет к капитализации и пишет журнал', async () => {
    const c = seedCompany({ employeePermanent: 100, nowPermanent: 100 });

    await service.applyCapitalization([{ companyId: c.companyId, amount: 140 }]);
    await service.applyCapitalization([{ companyId: c.companyId, amount: 140 }]);

    const after = companyRows.get(c.companyId);
    expect(after?.employeePermanent).toBe(380);
    expect(after?.nowPermanent).toBe(380);
    expect(after?.lastPermanent).toBe(240);
    expect(transactions.filter((t) => t.comment === 'Капитализация сотрудников')).toHaveLength(2);
  });

  it('нулевые начисления не попадают в журнал', async () => {
    const c = seedCompany();
    const credited = await service.applyCapitalization([{ companyId: c.companyId, amount: 0 }]);
    expect(credited).toBe(0);
    expect(transactions).toHaveLength(0);
  });

  it('доля модификатора копится отдельно от капитализации', async () => {
    const c = seedCompany();
    await service.applyCapitalization([
      { companyId: c.companyId, amount: 70, randomizerShare: 20 },
    ]);
    const after = companyRows.get(c.companyId);
    expect(after?.employeePermanent).toBe(70);
    expect(after?.randomizerCapitalized).toBe(20);
    // Учётная величина в журнал не выносится: доля модификатора — скрытая информация.
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amount).toBe(70);
  });
});

describe('зеркало постоянного контракта', () => {
  const EXEC = {} as never;

  it('при заключении компания получает весь постоянный рейтинг сотрудника', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 280, randomizer: 20, nowPermanent: 300 });

    await service.attachPermanentEmployee({
      personId: p.personId,
      companyId: c.companyId,
      exec: EXEC,
    });

    const after = companyRows.get(c.companyId);
    expect(after?.employeePermanent).toBe(300);
    expect(after?.nowPermanent).toBe(300);
    // Модификатор входит в зеркало, но в счётчик доли не попадает: пока сотрудник
    // в штате, его отмену отыграет обычный перенос дельты.
    expect(after?.randomizerCapitalized).toBe(0);
    expect(transactions[0]).toMatchObject({
      recipientCompanyId: c.companyId,
      amount: 300,
      kind: 'generated',
    });
  });

  it('нулевой рейтинг сотрудника ничего не пишет', async () => {
    const c = seedCompany();
    const p = seedPerson();
    await service.attachPermanentEmployee({
      personId: p.personId,
      companyId: c.companyId,
      exec: EXEC,
    });
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(0);
    expect(transactions).toHaveLength(0);
  });

  it('при разрыве уходит текущий рейтинг сотрудника, наработанное остаётся', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 300, nowPermanent: 300 });
    hireToCompany(p.personId, c.companyId);

    await service.attachPermanentEmployee({
      personId: p.personId,
      companyId: c.companyId,
      exec: EXEC,
    });
    // Плановое начисление за время работы — оно компании и останется.
    await service.applyCapitalization([{ companyId: c.companyId, amount: 100 }]);
    // Рост рейтинга сотрудника переносится дельтой и держит зеркало актуальным.
    await service.manualPersonTransaction({
      personId: p.personId,
      amount: 50,
      actorUserId: ACTOR,
    });
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(450);

    await service.detachPermanentEmployee({
      personId: p.personId,
      companyId: c.companyId,
      exec: EXEC,
    });

    const after = companyRows.get(c.companyId);
    expect(after?.employeePermanent).toBe(100);
    expect(after?.nowPermanent).toBe(100);
    expect(after?.lastPermanent).toBe(450);
    // У самого персонажа рейтинг остаётся при нём.
    expect(personRows.get(p.personId)?.nowPermanent).toBe(350);
  });

  it('отмена рандомайзера после зеркала не вычитает дважды', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 100, nowPermanent: 100 });

    // Модификатор проставлен до найма: пока контракта нет, переносить некуда.
    await service.randomizerApply({
      values: [{ personId: p.personId, value: 30 }],
      actorUserId: ACTOR,
    });
    hireToCompany(p.personId, c.companyId);
    await service.attachPermanentEmployee({
      personId: p.personId,
      companyId: c.companyId,
      exec: EXEC,
    });
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(130);

    await service.randomizerCancel(ACTOR);

    // Из зеркала ушло ровно 30 — один раз, переносом дельты.
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(100);
    expect(personRows.get(p.personId)?.nowPermanent).toBe(100);
  });
});

describe('обнуление рандомайзера снимает его долю в капитализации', () => {
  it('компания возвращается к значению, которое было бы без модификатора', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 50, nowPermanent: 50 });
    hireToCompany(p.personId, c.companyId);

    // Модификатор поднимает постоянный рейтинг персонажа: 50 → 70, перенос сразу.
    await service.randomizerApply({
      values: [{ personId: p.personId, value: 20 }],
      actorUserId: ACTOR,
    });
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(20);

    // Два плановых начисления: по 70 за сотрудника, из них по 20 — от модификатора.
    await service.applyCapitalization([
      { companyId: c.companyId, amount: 70, randomizerShare: 20 },
    ]);
    await service.applyCapitalization([
      { companyId: c.companyId, amount: 70, randomizerShare: 20 },
    ]);
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(160);

    await service.randomizerCancel(ACTOR);

    // Без модификатора было бы: 0 переноса + два начисления по 50 = 100.
    const after = companyRows.get(c.companyId);
    expect(after?.employeePermanent).toBe(100);
    expect(after?.nowPermanent).toBe(100);
    expect(after?.randomizerCapitalized).toBe(0);
    expect(personRows.get(p.personId)?.nowPermanent).toBe(50);
  });

  it('отрицательная доля при отмене возвращается компании', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 90, nowPermanent: 90 });
    hireToCompany(p.personId, c.companyId);

    await service.randomizerApply({
      values: [{ personId: p.personId, value: -30 }],
      actorUserId: ACTOR,
    });
    await service.applyCapitalization([
      { companyId: c.companyId, amount: 60, randomizerShare: -30 },
    ]);
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(30);

    await service.randomizerCancel(ACTOR);

    // Без модификатора: 0 переноса + начисление 90.
    expect(companyRows.get(c.companyId)?.employeePermanent).toBe(90);
  });

  it('повторная отмена компанию больше не трогает', async () => {
    const c = seedCompany();
    const p = seedPerson({ base: 50, nowPermanent: 50 });
    hireToCompany(p.personId, c.companyId);
    await service.randomizerApply({
      values: [{ personId: p.personId, value: 20 }],
      actorUserId: ACTOR,
    });
    await service.applyCapitalization([
      { companyId: c.companyId, amount: 70, randomizerShare: 20 },
    ]);
    await service.randomizerCancel(ACTOR);

    const afterFirst = { ...(companyRows.get(c.companyId) as object) };
    transactions.length = 0;
    await service.randomizerCancel(ACTOR);

    expect(companyRows.get(c.companyId)).toMatchObject(afterFirst);
    expect(transactions).toHaveLength(0);
  });
});

describe('star thresholds (via getPersonRating)', () => {
  it('isStar=true at nowPermanent >= 1000', async () => {
    const p = seedPerson({ base: 1000, nowPermanent: 1000 });
    const { isStar } = await service.getPersonRating(p.personId);
    expect(isStar).toBe(true);
  });

  it('isStar=true at >= 500 with active permanent', async () => {
    const p = seedPerson({ base: 500, nowPermanent: 500 });
    personHasContract.set(p.personId, true);
    const { isStar } = await service.getPersonRating(p.personId);
    expect(isStar).toBe(true);
  });

  it('isStar=false at 500 without contract', async () => {
    const p = seedPerson({ base: 500, nowPermanent: 500 });
    const { isStar } = await service.getPersonRating(p.personId);
    expect(isStar).toBe(false);
  });
});
