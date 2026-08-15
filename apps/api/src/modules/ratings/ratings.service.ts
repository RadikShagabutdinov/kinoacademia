import type {
  CompanyRatingDto,
  ManualRatingKind,
  ManualRatingMode,
  PersonRatingAdminDto,
  PersonRatingDto,
  RatingSlot,
  RatingTransactionDto,
  RatingTxKind,
} from '@kinoacademia/shared';
import {
  STAR_BONUS_MULTIPLIER,
  computeBreakupPenalty,
  computeIsStar,
  computePercentAmount,
} from '@kinoacademia/shared';
import { db } from '../../db/client';
import { setPenaltyHook, setPermanentMirrorHooks } from '../contracts/contracts.service';
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
  nowPermanent: row.nowPermanent,
  lastPermanent: row.lastPermanent,
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

/**
 * Начисление персонажу с переносом изменения постоянного рейтинга в капитализацию
 * его компании: постоянный рейтинг компании складывается из рейтингов сотрудников
 * на постоянном контракте, поэтому любое их изменение отражается сразу, не дожидаясь
 * 12-часовой капитализации. Правки только переменного рейтинга (`generated`) на
 * компанию не влияют — сравнивается именно `nowPermanent`.
 *
 * Возвращает компанию, которую задело начисление, чтобы вызывающий код отправил ей
 * WS-событие после коммита транзакции.
 */
const applyPersonDeltaPropagating = async (
  exec: DbExecutor,
  personId: string,
  delta: repo.PersonRatingDelta,
): Promise<{ row: PersonRatingRow; companyId: string | null }> => {
  const before = await repo.ensurePersonRating(exec, personId);
  const row = await repo.applyPersonDelta(exec, personId, delta);
  const diff = row.nowPermanent - before.nowPermanent;
  if (diff === 0) return { row, companyId: null };

  const companyId = await repo.findActivePermanentCompanyId(exec, personId);
  if (!companyId) return { row, companyId: null };

  await repo.applyCompanyDelta(exec, companyId, { employeePermanent: diff });
  await repo.insertTransaction(exec, {
    donorPersonId: personId,
    recipientCompanyId: companyId,
    amount: diff,
    kind: 'generated',
    // Нейтральная формулировка: в истории компании не должно быть видно, какая
    // именно механика (в том числе скрытый мастерский модификатор) сдвинула рейтинг.
    comment: 'Изменение постоянного рейтинга сотрудника',
    authorUserId: null,
  });
  return { row, companyId };
};

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
    const recipient = await applyPersonDeltaPropagating(tx, input.recipientPersonId, {
      systemTopup: credit,
    });
    const updatedRecipient = recipient.row;

    const txRow = await repo.insertTransaction(tx, {
      donorPersonId: input.donorPersonId,
      recipientPersonId: input.recipientPersonId,
      amount: credit,
      kind: multiplier === STAR_BONUS_MULTIPLIER ? 'star_bonus' : 'variable_to_permanent',
      comment: input.comment ?? null,
      authorUserId: input.actorUserId,
    });

    return {
      donor: updatedDonor,
      recipient: updatedRecipient,
      tx: txRow,
      companyId: recipient.companyId,
    };
  });

  emitPerson(input.donorPersonId);
  emitPerson(input.recipientPersonId);
  if (result.companyId) emitCompany(result.companyId);
  return result;
};

const resolvePercentAmount = (percent: number, base: number): number => {
  if (percent === 0) {
    throw new RatingError('invalid_amount', 'Percent value must be non-zero');
  }
  return computePercentAmount(percent, base);
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
  return resolvePercentAmount(amount, row.nowPermanent);
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
): Promise<{ row: PersonRatingRow; tx: RatingTransactionRow; companyId: string | null }> => {
  const { row, companyId } = await applyPersonDeltaPropagating(
    exec,
    input.personId,
    personDeltaFor(kind, input.amount),
  );
  const txRow = await repo.insertTransaction(exec, {
    recipientPersonId: input.personId,
    amount: input.amount,
    kind,
    comment: input.comment ?? null,
    authorUserId: input.actorUserId,
  });
  return { row, tx: txRow, companyId };
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
  if (result.companyId) emitCompany(result.companyId);
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

/** Сторона ручной транзакции админа. Соответствие типа и `slot` гарантирует `ManualRatingInput`. */
export type ManualTxParty = {
  type: 'person' | 'company';
  id: string;
  slot: RatingSlot;
};

export type ManualTransactionInput = {
  to: ManualTxParty & { kind: ManualRatingKind };
  from?: ManualTxParty;
  amount: number;
  mode: ManualRatingMode;
  comment?: string;
  actorUserId: string;
};

/** Строка рейтинга стороны вместе с её типом — вызывающему коду не нужны приведения. */
export type ManualTxPartyRow =
  | { type: 'person'; row: PersonRatingRow; isStar: boolean }
  | { type: 'company'; row: CompanyRatingRow };

export type ManualTransactionResult = {
  target: ManualTxPartyRow;
  source: ManualTxPartyRow | null;
  tx: RatingTransactionRow;
};

const creditPersonDelta = (
  slot: RatingSlot,
  kind: ManualRatingKind,
  amount: number,
): repo.PersonRatingDelta =>
  slot === 'variable' ? { generated: amount } : personDeltaFor(kind, amount);

const creditCompanyDelta = (
  slot: RatingSlot,
  kind: ManualRatingKind,
  amount: number,
): repo.CompanyRatingPatch =>
  slot === 'budget'
    ? { budget: amount }
    : // `base` до компании не доходит — схема ввода допускает его только для персонажа.
      companyDeltaFor(kind === 'base' ? 'manual' : kind, amount);

/**
 * У источника выбора составляющей нет: постоянный рейтинг всегда списывается из
 * «ручной» составляющей, иначе пришлось бы «снимать оскар» или «снимать базу».
 */
const debitPersonDelta = (slot: RatingSlot, amount: number): repo.PersonRatingDelta =>
  slot === 'variable' ? { generated: -amount } : { manualTopup: -amount };

const debitCompanyDelta = (slot: RatingSlot, amount: number): repo.CompanyRatingPatch =>
  slot === 'budget' ? { budget: -amount } : { manualTopup: -amount };

/** Вид записи в журнале выводится из части рейтинга получателя. */
const manualTxKind = (slot: RatingSlot, kind: ManualRatingKind): RatingTxKind => {
  switch (slot) {
    case 'variable':
      return 'generated';
    case 'budget':
      return 'budget';
    default:
      return kind;
  }
};

const readParty = async (exec: DbExecutor, party: ManualTxParty): Promise<ManualTxPartyRow> => {
  if (party.type === 'company') {
    return { type: 'company', row: await repo.ensureCompanyRating(exec, party.id) };
  }
  const row = await repo.ensurePersonRating(exec, party.id);
  return { type: 'person', row, isStar: await isPersonStar(exec, row) };
};

const partyBalance = (party: ManualTxParty, read: ManualTxPartyRow): number =>
  read.type === 'person'
    ? party.slot === 'variable'
      ? read.row.generated
      : read.row.nowPermanent
    : party.slot === 'budget'
      ? read.row.budget
      : read.row.nowPermanent;

/**
 * Ручная транзакция админа: начисление получателю в выбранную часть рейтинга и,
 * если указан источник, зеркальное списание у него. Без источника рейтинг берётся
 * из неисчерпаемого админского ресурса — тогда допустима и отрицательная сумма
 * (прямое списание у получателя).
 *
 * Отрицательный рейтинг в игре невозможен (единственное исключение — скрытый
 * мастерский модификатор), поэтому операция, уводящая затронутую часть в минус,
 * отклоняется целиком.
 */
export const manualTransaction = async (
  input: ManualTransactionInput,
): Promise<ManualTransactionResult> => {
  const result = await db.transaction(async (tx) => {
    const targetBefore = await readParty(tx, input.to);
    const sourceBefore = input.from ? await readParty(tx, input.from) : null;

    let amount = input.amount;
    if (input.mode === 'percent') {
      // Процентом платит только компания со своего постоянного счёта — процент
      // считается от её постоянного рейтинга (то же правило проверяет схема ввода).
      if (!input.from || !sourceBefore || input.from.type !== 'company') {
        throw new RatingError('invalid_amount', 'Percent mode requires a company source');
      }
      if (input.from.slot !== 'permanent') {
        throw new RatingError('invalid_amount', 'Percent mode requires a permanent-rating source');
      }
      amount = resolvePercentAmount(input.amount, partyBalance(input.from, sourceBefore));
      if (amount <= 0) {
        throw new RatingError('invalid_amount', 'Percent resolves to a non-transferable amount');
      }
    }

    if (input.from && sourceBefore) {
      if (partyBalance(input.from, sourceBefore) - amount < 0) {
        throw new RatingError(
          'insufficient_rating',
          'Source has not enough rating for this transfer',
        );
      }
    } else if (partyBalance(input.to, targetBefore) + amount < 0) {
      throw new RatingError('insufficient_rating', 'Target rating cannot go negative');
    }

    const touchedCompanies = new Set<string>();

    if (input.from) {
      if (input.from.type === 'person') {
        const { companyId } = await applyPersonDeltaPropagating(
          tx,
          input.from.id,
          debitPersonDelta(input.from.slot, amount),
        );
        if (companyId) touchedCompanies.add(companyId);
      } else {
        await repo.applyCompanyDelta(tx, input.from.id, debitCompanyDelta(input.from.slot, amount));
      }
    }

    if (input.to.type === 'person') {
      const { companyId } = await applyPersonDeltaPropagating(
        tx,
        input.to.id,
        creditPersonDelta(input.to.slot, input.to.kind, amount),
      );
      if (companyId) touchedCompanies.add(companyId);
    } else {
      await repo.applyCompanyDelta(
        tx,
        input.to.id,
        creditCompanyDelta(input.to.slot, input.to.kind, amount),
      );
    }

    const txRow = await repo.insertTransaction(tx, {
      ...(input.from?.type === 'person' && { donorPersonId: input.from.id }),
      ...(input.from?.type === 'company' && { donorCompanyId: input.from.id }),
      ...(input.to.type === 'person'
        ? { recipientPersonId: input.to.id }
        : { recipientCompanyId: input.to.id }),
      amount,
      kind: manualTxKind(input.to.slot, input.to.kind),
      comment: input.comment ?? null,
      authorUserId: input.actorUserId,
    });

    // Источник и получатель могут быть одной сущностью (перевод между своими
    // частями рейтинга), поэтому итоговые строки перечитываем после обеих правок.
    return {
      target: await readParty(tx, input.to),
      source: input.from ? await readParty(tx, input.from) : null,
      tx: txRow,
      touchedCompanies,
    };
  });

  const persons = new Set<string>();
  const companies = new Set(result.touchedCompanies);
  for (const party of [input.to, input.from]) {
    if (!party) continue;
    if (party.type === 'person') persons.add(party.id);
    else companies.add(party.id);
  }
  for (const personId of persons) emitPerson(personId);
  for (const companyId of companies) emitCompany(companyId);

  return { target: result.target, source: result.source, tx: result.tx };
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
  reason: string;
  exec?: DbExecutor;
};

/**
 * Штраф списывается с персонажа и зачисляется компании. Перенос в капитализацию
 * тут не срабатывает: контракт к этому моменту уже разорван (`endedAt` проставлен
 * до вызова штрафа в contracts.service), так что списание персонажа компанию не
 * тянет вниз — она получает только сам штраф.
 *
 * Возвращает фактический размер штрафа (0 — если списывать нечего).
 */
const applyContractBreakPenaltyOn = async (
  exec: DbExecutor,
  input: ContractBreakPenaltyInput,
): Promise<number> => {
  const row = await repo.ensurePersonRating(exec, input.personId);
  // База штрафа — постоянный рейтинг без скрытого мастерского модификатора.
  const permanentWithoutRandomizer = row.nowPermanent - row.randomizer;
  // Разрывается постоянный контракт, то есть на момент разрыва он ещё действовал:
  // статус Звезды считаем по порогу «с контрактом», как было до разрыва.
  const amount = computeBreakupPenalty(
    permanentWithoutRandomizer,
    computeIsStar(row.nowPermanent, true),
  );
  if (amount <= 0) return 0;

  await applyPersonDeltaPropagating(exec, input.personId, { penalties: amount });
  await repo.applyCompanyDelta(exec, input.companyId, { penalties: amount });
  await repo.insertTransaction(exec, {
    donorPersonId: input.personId,
    recipientCompanyId: input.companyId,
    amount,
    kind: 'penalty',
    comment: input.reason,
    authorUserId: null,
  });
  return amount;
};

export const applyContractBreakPenalty = async (
  input: ContractBreakPenaltyInput,
): Promise<number> => {
  const amount = input.exec
    ? await applyContractBreakPenaltyOn(input.exec, input)
    : await db.transaction((tx) => applyContractBreakPenaltyOn(tx, input));
  if (amount > 0) {
    emitPerson(input.personId);
    emitCompany(input.companyId);
  }
  return amount;
};

export type PermanentMirrorInput = {
  personId: string;
  companyId: string;
  exec: DbExecutor;
};

/**
 * Зеркало постоянного контракта: рейтинг сотрудника не переходит компании, а
 * учитывается у обоих сразу — пока контракт действует, он входит в капитализацию
 * компании целиком (без потолка, который действует только для плановых начислений).
 * Дальнейшие изменения рейтинга держит в актуальном состоянии
 * `applyPersonDeltaPropagating`, а при завершении контракта зеркало снимается.
 *
 * `randomizerCapitalized` намеренно не трогаем: пока сотрудник в штате, отмена
 * модификатора убирает его из зеркала обычным переносом дельты, и учёт в счётчике
 * привёл бы к двойному вычитанию.
 */
const applyMirror = async (input: PermanentMirrorInput, sign: 1 | -1): Promise<void> => {
  const person = await repo.ensurePersonRating(input.exec, input.personId);
  const amount = sign * person.nowPermanent;
  if (amount === 0) return;

  await repo.applyCompanyDelta(input.exec, input.companyId, { employeePermanent: amount });
  await repo.insertTransaction(input.exec, {
    donorPersonId: input.personId,
    recipientCompanyId: input.companyId,
    amount,
    kind: 'generated',
    comment:
      sign === 1
        ? 'Рейтинг сотрудника при заключении контракта'
        : 'Рейтинг сотрудника при разрыве контракта',
    authorUserId: null,
  });
  emitCompany(input.companyId);
};

export const attachPermanentEmployee = (input: PermanentMirrorInput): Promise<void> =>
  applyMirror(input, 1);

export const detachPermanentEmployee = (input: PermanentMirrorInput): Promise<void> =>
  applyMirror(input, -1);

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
    const companyIds = new Set<string>();
    for (const entry of input.values) {
      const current = await repo.ensurePersonRating(tx, entry.personId);
      const delta = entry.value - current.randomizer;
      const { row, companyId } = await applyPersonDeltaPropagating(tx, entry.personId, {
        randomizer: delta,
      });
      await repo.insertTransaction(tx, {
        recipientPersonId: entry.personId,
        amount: delta,
        kind: 'randomizer',
        comment: 'randomizer apply',
        authorUserId: input.actorUserId,
      });
      rows.push(row);
      if (companyId) companyIds.add(companyId);
    }
    return { rows, companyIds };
  });

  for (const r of updated.rows) emitPerson(r.personId);
  for (const companyId of updated.companyIds) emitCompany(companyId);
  return updated.rows;
};

export const randomizerCancel = async (actorUserId: string): Promise<PersonRatingRow[]> => {
  const updated = await db.transaction(async (tx) => {
    const all = await repo.listAllPersonRatings(tx);
    const rows: PersonRatingRow[] = [];
    const companyIds = new Set<string>();
    for (const current of all) {
      if (current.randomizer === 0) continue;
      const delta = -current.randomizer;
      const { row, companyId } = await applyPersonDeltaPropagating(tx, current.personId, {
        randomizer: delta,
      });
      await repo.insertTransaction(tx, {
        recipientPersonId: current.personId,
        amount: delta,
        kind: 'randomizer',
        comment: 'randomizer cancel',
        authorUserId: actorUserId,
      });
      rows.push(row);
      if (companyId) companyIds.add(companyId);
    }

    // Цикл выше откатил только мгновенный перенос (дельта `−randomizer` персонажа
    // уходит в капитализацию его компании тем же путём, что и начисление). Всё,
    // что модификатор накапал компаниям плановыми начислениями, лежит отдельной
    // учётной величиной — изымаем её здесь, иначе это осталось бы в компании
    // навсегда. Считать её частью цикла нельзя: вычли бы дважды.
    const withCapitalized = await repo.listCompanyRatingsWithRandomizerCapitalized(tx);
    for (const company of withCapitalized) {
      const delta = -company.randomizerCapitalized;
      await repo.applyCompanyDelta(tx, company.companyId, {
        employeePermanent: delta,
        randomizerCapitalized: delta,
      });
      await repo.insertTransaction(tx, {
        recipientCompanyId: company.companyId,
        amount: delta,
        kind: 'generated',
        comment: 'Пересчёт капитализации',
        authorUserId: actorUserId,
      });
      companyIds.add(company.companyId);
    }

    return { rows, companyIds };
  });

  for (const r of updated.rows) emitPerson(r.personId);
  for (const companyId of updated.companyIds) emitCompany(companyId);
  return updated.rows;
};

/**
 * Начисление капитализации компаниям (джоба `capitalize_companies`): начисления
 * накопительные, поэтому в журнал и в `employee_permanent` идёт именно прибавка.
 * Доля секретного модификатора копится отдельной учётной величиной — её изымает
 * `randomizerCancel`; в журнал она не выносится.
 */
export const applyCapitalization = async (
  entries: Array<{ companyId: string; amount: number; randomizerShare?: number }>,
): Promise<number> => {
  const credited = entries.filter((e) => e.amount !== 0 || e.randomizerShare);
  if (credited.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const entry of credited) {
      await repo.applyCompanyDelta(tx, entry.companyId, {
        employeePermanent: entry.amount,
        ...(entry.randomizerShare !== undefined && {
          randomizerCapitalized: entry.randomizerShare,
        }),
      });
      // Нулевое начисление в журнал не пишем: доля модификатора может быть
      // ненулевой и при нулевой прибавке (у сотрудника отрицательная база).
      if (entry.amount !== 0) {
        await repo.insertTransaction(tx, {
          recipientCompanyId: entry.companyId,
          amount: entry.amount,
          kind: 'generated',
          comment: 'Капитализация сотрудников',
          authorUserId: null,
        });
      }
    }
  });

  for (const entry of credited) emitCompany(entry.companyId);
  return credited.length;
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

let contractHooksWired = false;

/**
 * Подключает к contracts.service рейтинговые побочные эффекты контрактов: штраф
 * за разрыв и зеркало постоянного рейтинга сотрудника. Вызывается один раз при
 * старте API (в `index.ts`).
 */
export const wireContractRatingHooks = (): void => {
  if (contractHooksWired) return;
  contractHooksWired = true;
  setPenaltyHook(async (payload, exec) => {
    await applyContractBreakPenalty({
      personId: payload.personId,
      companyId: payload.companyId,
      reason: payload.reason,
      exec: exec as DbExecutor,
    });
  });
  setPermanentMirrorHooks({
    attach: (payload, exec) => attachPermanentEmployee({ ...payload, exec: exec as DbExecutor }),
    detach: (payload, exec) => detachPermanentEmployee({ ...payload, exec: exec as DbExecutor }),
  });
};
