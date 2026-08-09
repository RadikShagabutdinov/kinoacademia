import type {
  CompanyRatingDto,
  ManualRatingMode,
  PersonRatingAdminDto,
  PersonRatingDto,
  RatingTransactionDto,
  RatingTxKind,
} from '@kinoacademia/shared';
import { STAR_BONUS_MULTIPLIER, computeIsStar } from '@kinoacademia/shared';
import { db } from '../../db/client';
import { setPenaltyHook } from '../contracts/contracts.service';
import { RatingError } from './errors';
import { ratingsEmitter } from './events';
import * as repo from './ratings-repo';
import type {
  CompanyRatingRow,
  DbExecutor,
  PersonRatingRow,
  RatingTransactionRow,
} from './ratings-repo';

const emitPerson = (personId: string): void => {
  ratingsEmitter.emit('rating.updated', { kind: 'person', personId });
};

const emitCompany = (companyId: string): void => {
  ratingsEmitter.emit('rating.updated', { kind: 'company', companyId });
};

/**
 * Игровая сериализация: секретный мастерский модификатор складываем в базу,
 * иначе сумма составляющих не сойдётся с `nowPermanent` и игрок заметит
 * скрытое слагаемое. Для админки есть `toPersonRatingAdminDto`.
 */
export const toPersonRatingDto = (row: PersonRatingRow, isStar: boolean): PersonRatingDto => ({
  personId: row.personId,
  generated: row.generated,
  nowPermanent: row.nowPermanent,
  lastPermanent: row.lastPermanent,
  base: row.base + row.randomizer,
  systemTopup: row.systemTopup,
  manualTopup: row.manualTopup,
  oscar: row.oscar,
  penalties: row.penalties,
  isStar,
  updatedAt: row.updatedAt.toISOString(),
});

/** Полная разбивка с сырой базой и модификатором — только для admin-эндпоинтов. */
export const toPersonRatingAdminDto = (
  row: PersonRatingRow,
  isStar: boolean,
): PersonRatingAdminDto => ({
  ...toPersonRatingDto(row, isStar),
  base: row.base,
  randomizer: row.randomizer,
});

export const toCompanyRatingDto = (row: CompanyRatingRow): CompanyRatingDto => ({
  companyId: row.companyId,
  budget: row.budget,
  employeePermanent: row.employeePermanent,
  manualTopup: row.manualTopup,
  oscar: row.oscar,
  penalties: row.penalties,
  updatedAt: row.updatedAt.toISOString(),
});

export const toTransactionDto = (row: RatingTransactionRow): RatingTransactionDto => ({
  id: row.id,
  donorPersonId: row.donorPersonId,
  donorCompanyId: row.donorCompanyId,
  recipientPersonId: row.recipientPersonId,
  recipientCompanyId: row.recipientCompanyId,
  amount: row.amount,
  kind: row.kind,
  comment: row.comment,
  authorUserId: row.authorUserId,
  createdAt: row.createdAt.toISOString(),
});

const isPersonStar = async (exec: DbExecutor, row: PersonRatingRow): Promise<boolean> => {
  const hasContract = await repo.findActivePermanentByPersonId(exec, row.personId);
  return computeIsStar(row.nowPermanent, hasContract);
};

export type ExpressAdmirationInput = {
  donorPersonId: string;
  recipientPersonId: string;
  amount: number;
  actorUserId: string;
  comment?: string;
};

export const expressAdmiration = async (
  input: ExpressAdmirationInput,
): Promise<{ donor: PersonRatingRow; recipient: PersonRatingRow; tx: RatingTransactionRow }> => {
  if (input.amount <= 0) {
    throw new RatingError('invalid_amount', 'Amount must be positive');
  }
  if (input.donorPersonId === input.recipientPersonId) {
    throw new RatingError('self_transfer', 'Cannot transfer rating to yourself');
  }

  const result = await db.transaction(async (tx) => {
    const donor = await repo.ensurePersonRating(tx, input.donorPersonId);
    if (donor.generated < input.amount) {
      throw new RatingError('insufficient_generated', 'Not enough variable rating to transfer');
    }
    // Строка рейтинга получателя может ещё не существовать — создаём до начисления.
    await repo.ensurePersonRating(tx, input.recipientPersonId);

    const donorIsStar = await isPersonStar(tx, donor);
    const multiplier = donorIsStar ? STAR_BONUS_MULTIPLIER : 1;
    const credit = input.amount * multiplier;

    const updatedDonor = await repo.applyPersonDelta(tx, input.donorPersonId, {
      generated: -input.amount,
    });
    const updatedRecipient = await repo.applyPersonDelta(tx, input.recipientPersonId, {
      systemTopup: credit,
    });

    const txRow = await repo.insertTransaction(tx, {
      donorPersonId: input.donorPersonId,
      recipientPersonId: input.recipientPersonId,
      amount: credit,
      kind: multiplier === STAR_BONUS_MULTIPLIER ? 'star_bonus' : 'variable_to_permanent',
      comment: input.comment ?? null,
      authorUserId: input.actorUserId,
    });

    return { donor: updatedDonor, recipient: updatedRecipient, tx: txRow };
  });

  emitPerson(input.donorPersonId);
  emitPerson(input.recipientPersonId);
  return result;
};

const resolvePercentAmount = (percent: number, base: number): number => {
  if (percent === 0) {
    throw new RatingError('invalid_amount', 'Percent value must be non-zero');
  }
  return Math.round((base * percent) / 100);
};

const resolveManualAmount = async (
  exec: DbExecutor,
  mode: ManualRatingMode | undefined,
  amount: number,
  target: { kind: 'person'; personId: string } | { kind: 'company'; companyId: string },
): Promise<number> => {
  if (mode !== 'percent') return amount;

  if (target.kind === 'person') {
    const row = await repo.ensurePersonRating(exec, target.personId);
    return resolvePercentAmount(amount, row.nowPermanent);
  }

  const row = await repo.ensureCompanyRating(exec, target.companyId);
  const base = row.employeePermanent + row.manualTopup + row.oscar - row.penalties;
  return resolvePercentAmount(amount, base);
};

export type PersonManualKind = 'manual' | 'oscar' | 'penalty' | 'base';

export type ManualPersonInput = {
  personId: string;
  amount: number;
  comment?: string;
  mode?: ManualRatingMode;
  kind?: PersonManualKind;
  actorUserId: string | null;
  exec?: DbExecutor;
};

const personDeltaFor = (kind: PersonManualKind, amount: number) => {
  switch (kind) {
    case 'oscar':
      return { oscar: amount };
    case 'penalty':
      return { penalties: -amount };
    case 'base':
      return { base: amount };
    default:
      return { manualTopup: amount };
  }
};

const manualPersonOn = async (
  exec: DbExecutor,
  input: ManualPersonInput,
  kind: PersonManualKind,
): Promise<{ row: PersonRatingRow; tx: RatingTransactionRow }> => {
  const row = await repo.applyPersonDelta(exec, input.personId, personDeltaFor(kind, input.amount));
  const txRow = await repo.insertTransaction(exec, {
    recipientPersonId: input.personId,
    amount: input.amount,
    kind,
    comment: input.comment ?? null,
    authorUserId: input.actorUserId,
  });
  return { row, tx: txRow };
};

export const manualPersonTransaction = async (
  input: ManualPersonInput,
): Promise<{ row: PersonRatingRow; tx: RatingTransactionRow }> => {
  const kind = input.kind ?? 'manual';

  const run = async (exec: DbExecutor) => {
    const resolvedAmount = await resolveManualAmount(exec, input.mode, input.amount, {
      kind: 'person',
      personId: input.personId,
    });
    return manualPersonOn(exec, { ...input, amount: resolvedAmount }, kind);
  };

  const result = input.exec ? await run(input.exec) : await db.transaction((tx) => run(tx));

  emitPerson(input.personId);
  return result;
};

export type CompanyManualKind = 'manual' | 'oscar' | 'penalty' | 'budget';

export type ManualCompanyInput = {
  companyId: string;
  amount: number;
  comment?: string;
  mode?: ManualRatingMode;
  kind?: CompanyManualKind;
  actorUserId: string | null;
  exec?: DbExecutor;
};

const companyDeltaFor = (kind: CompanyManualKind, amount: number) => {
  switch (kind) {
    case 'oscar':
      return { oscar: amount };
    case 'penalty':
      return { penalties: amount };
    case 'budget':
      return { budget: amount };
    default:
      return { manualTopup: amount };
  }
};

const manualCompanyOn = async (
  exec: DbExecutor,
  input: ManualCompanyInput,
  kind: CompanyManualKind,
): Promise<{ row: CompanyRatingRow; tx: RatingTransactionRow }> => {
  const row = await repo.applyCompanyDelta(
    exec,
    input.companyId,
    companyDeltaFor(kind, input.amount),
  );
  const txRow = await repo.insertTransaction(exec, {
    recipientCompanyId: input.companyId,
    amount: input.amount,
    kind,
    comment: input.comment ?? null,
    authorUserId: input.actorUserId,
  });
  return { row, tx: txRow };
};

export const manualCompanyTransaction = async (
  input: ManualCompanyInput,
): Promise<{ row: CompanyRatingRow; tx: RatingTransactionRow }> => {
  const kind = input.kind ?? 'manual';

  const run = async (exec: DbExecutor) => {
    const resolvedAmount = await resolveManualAmount(exec, input.mode, input.amount, {
      kind: 'company',
      companyId: input.companyId,
    });
    return manualCompanyOn(exec, { ...input, amount: resolvedAmount }, kind);
  };

  const result = input.exec ? await run(input.exec) : await db.transaction((tx) => run(tx));

  emitCompany(input.companyId);
  return result;
};

export const applyOscarToPerson = (
  input: Omit<ManualPersonInput, 'kind' | 'mode'>,
): Promise<{ row: PersonRatingRow; tx: RatingTransactionRow }> =>
  manualPersonTransaction({ ...input, kind: 'oscar', mode: 'absolute' });

export const applyOscarToCompany = (
  input: Omit<ManualCompanyInput, 'kind' | 'mode'>,
): Promise<{ row: CompanyRatingRow; tx: RatingTransactionRow }> =>
  manualCompanyTransaction({ ...input, kind: 'oscar', mode: 'absolute' });

export type { DbExecutor } from './ratings-repo';

export type ContractBreakPenaltyInput = {
  personId: string;
  companyId: string;
  amount: number;
  reason: string;
  exec?: DbExecutor;
};

const applyContractBreakPenaltyOn = async (
  exec: DbExecutor,
  input: ContractBreakPenaltyInput,
): Promise<void> => {
  await repo.applyPersonDelta(exec, input.personId, { penalties: input.amount });
  await repo.applyCompanyDelta(exec, input.companyId, { penalties: input.amount });
  await repo.insertTransaction(exec, {
    donorPersonId: input.personId,
    recipientCompanyId: input.companyId,
    amount: input.amount,
    kind: 'penalty',
    comment: input.reason,
    authorUserId: null,
  });
};

export const applyContractBreakPenalty = async (
  input: ContractBreakPenaltyInput,
): Promise<void> => {
  if (input.exec) {
    await applyContractBreakPenaltyOn(input.exec, input);
  } else {
    await db.transaction((tx) => applyContractBreakPenaltyOn(tx, input));
  }
  emitPerson(input.personId);
  emitCompany(input.companyId);
};

export type RandomizerApplyInput = {
  values: Array<{ personId: string; value: number }>;
  actorUserId: string;
};

export const randomizerApply = async (input: RandomizerApplyInput): Promise<PersonRatingRow[]> => {
  const seen = new Set<string>();
  for (const v of input.values) {
    if (seen.has(v.personId)) {
      throw new RatingError(
        'duplicate_randomizer_target',
        `Duplicate personId in randomizer payload: ${v.personId}`,
      );
    }
    seen.add(v.personId);
  }

  const updated = await db.transaction(async (tx) => {
    const rows: PersonRatingRow[] = [];
    for (const entry of input.values) {
      const current = await repo.ensurePersonRating(tx, entry.personId);
      const delta = entry.value - current.randomizer;
      const row = await repo.applyPersonDelta(tx, entry.personId, { randomizer: delta });
      await repo.insertTransaction(tx, {
        recipientPersonId: entry.personId,
        amount: delta,
        kind: 'randomizer',
        comment: 'randomizer apply',
        authorUserId: input.actorUserId,
      });
      rows.push(row);
    }
    return rows;
  });

  for (const r of updated) emitPerson(r.personId);
  return updated;
};

export const randomizerCancel = async (actorUserId: string): Promise<PersonRatingRow[]> => {
  const updated = await db.transaction(async (tx) => {
    const all = await repo.listAllPersonRatings(tx);
    const rows: PersonRatingRow[] = [];
    for (const current of all) {
      if (current.randomizer === 0) continue;
      const delta = -current.randomizer;
      const row = await repo.applyPersonDelta(tx, current.personId, { randomizer: delta });
      await repo.insertTransaction(tx, {
        recipientPersonId: current.personId,
        amount: delta,
        kind: 'randomizer',
        comment: 'randomizer cancel',
        authorUserId: actorUserId,
      });
      rows.push(row);
    }
    return rows;
  });

  for (const r of updated) emitPerson(r.personId);
  return updated;
};

export const getPersonRating = async (
  personId: string,
): Promise<{ row: PersonRatingRow; isStar: boolean }> => {
  const row = await repo.ensurePersonRating(db, personId);
  const isStar = await isPersonStar(db, row);
  return { row, isStar };
};

export const getCompanyRating = async (companyId: string): Promise<CompanyRatingRow> =>
  repo.ensureCompanyRating(db, companyId);

export const listPersonHistory = (personId: string, limit?: number, kind?: RatingTxKind) =>
  repo.listPersonHistory(db, personId, limit, kind);

/** Виды транзакций, которых для игрока не существует (секретные мастерские механики). */
const PLAYER_HIDDEN_TX_KINDS: RatingTxKind[] = ['randomizer'];

/**
 * История для игровых экранов: скрытые виды не отдаём и на явный запрос по ним
 * (пустой ответ вместо ошибки — ошибка подсказала бы, что вид существует).
 */
export const listPersonHistoryForPlayer = async (
  personId: string,
  limit?: number,
  kind?: RatingTxKind,
): Promise<RatingTransactionRow[]> => {
  if (kind && PLAYER_HIDDEN_TX_KINDS.includes(kind)) return [];
  return repo.listPersonHistory(db, personId, limit, kind, PLAYER_HIDDEN_TX_KINDS);
};

export const listCompanyHistory = (companyId: string, limit?: number, kind?: RatingTxKind) =>
  repo.listCompanyHistory(db, companyId, limit, kind);

export const listAllPersonRatings = () => repo.listAllPersonRatings(db);
export const listAllCompanyRatings = () => repo.listAllCompanyRatings(db);

/**
 * Рейтинги всех персонажей вместе с посчитанным статусом Звезды: активные
 * постоянные контракты берутся одним запросом, без обращения на каждую строку.
 */
export const listAllPersonRatingsWithStar = async (): Promise<
  Array<{ row: PersonRatingRow; isStar: boolean }>
> => {
  const [rows, withContract] = await Promise.all([
    repo.listAllPersonRatings(db),
    repo.listPersonIdsWithActivePermanent(db),
  ]);
  return rows.map((row) => ({
    row,
    isStar: computeIsStar(row.nowPermanent, withContract.has(row.personId)),
  }));
};

let penaltyHookWired = false;

/**
 * Подключает рейтинговый штраф к contracts.service. Вызывается один раз при
 * старте API (в `index.ts`).
 */
export const wireContractPenalties = (): void => {
  if (penaltyHookWired) return;
  penaltyHookWired = true;
  setPenaltyHook(async (payload, exec) => {
    await applyContractBreakPenalty({
      personId: payload.personId,
      companyId: payload.companyId,
      amount: payload.amount,
      reason: payload.reason,
      exec: exec as DbExecutor,
    });
  });
};
