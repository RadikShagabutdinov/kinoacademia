import type { RatingTxKind } from '@kinoacademia/shared';
import { and, desc, eq, isNull, notInArray, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { companyRatings, personRatings, ratingTransactions } from '../../db/schema';

export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export type PersonRatingRow = {
  personId: string;
  generated: number;
  nowPermanent: number;
  lastPermanent: number;
  base: number;
  randomizer: number;
  systemTopup: number;
  manualTopup: number;
  oscar: number;
  penalties: number;
  updatedAt: Date;
};

export type CompanyRatingRow = {
  companyId: string;
  budget: number;
  employeePermanent: number;
  manualTopup: number;
  oscar: number;
  penalties: number;
  updatedAt: Date;
};

export type RatingTransactionRow = {
  id: string;
  donorPersonId: string | null;
  donorCompanyId: string | null;
  recipientPersonId: string | null;
  recipientCompanyId: string | null;
  amount: number;
  kind: RatingTxKind;
  comment: string | null;
  authorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const toPersonRow = (r: typeof personRatings.$inferSelect): PersonRatingRow => ({
  personId: r.personId,
  generated: r.generated,
  nowPermanent: r.nowPermanent,
  lastPermanent: r.lastPermanent,
  base: r.base,
  randomizer: r.randomizer,
  systemTopup: r.systemTopup,
  manualTopup: r.manualTopup,
  oscar: r.oscar,
  penalties: r.penalties,
  updatedAt: r.updatedAt,
});

const toCompanyRow = (r: typeof companyRatings.$inferSelect): CompanyRatingRow => ({
  companyId: r.companyId,
  budget: r.budget,
  employeePermanent: r.employeePermanent,
  manualTopup: r.manualTopup,
  oscar: r.oscar,
  penalties: r.penalties,
  updatedAt: r.updatedAt,
});

const toTxRow = (r: typeof ratingTransactions.$inferSelect): RatingTransactionRow => ({
  id: r.id,
  donorPersonId: r.donorPersonId ?? null,
  donorCompanyId: r.donorCompanyId ?? null,
  recipientPersonId: r.recipientPersonId ?? null,
  recipientCompanyId: r.recipientCompanyId ?? null,
  amount: r.amount,
  kind: r.kind as RatingTxKind,
  comment: r.comment ?? null,
  authorUserId: r.authorUserId ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const calcPersonNowPermanent = (
  parts: Pick<
    PersonRatingRow,
    'base' | 'randomizer' | 'systemTopup' | 'manualTopup' | 'oscar' | 'penalties'
  >,
): number =>
  parts.base +
  parts.randomizer +
  parts.systemTopup +
  parts.manualTopup +
  parts.oscar -
  parts.penalties;

/**
 * Для компании поле `penalties` отражает поступления-штрафы (зачисляются при
 * одностороннем разрыве permanent-контракта персонажем) и потому прибавляется,
 * в отличие от персонажа, где `penalties` — сумма списаний.
 */
export const calcCompanyNowPermanent = (
  parts: Pick<CompanyRatingRow, 'employeePermanent' | 'manualTopup' | 'oscar' | 'penalties'>,
): number => parts.employeePermanent + parts.manualTopup + parts.oscar + parts.penalties;

export const ensurePersonRating = async (
  exec: DbExecutor,
  personId: string,
): Promise<PersonRatingRow> => {
  const existing = await exec
    .select()
    .from(personRatings)
    .where(eq(personRatings.personId, personId))
    .limit(1);
  if (existing[0]) return toPersonRow(existing[0]);

  const inserted = await exec
    .insert(personRatings)
    .values({ personId })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return toPersonRow(inserted[0]);

  const after = await exec
    .select()
    .from(personRatings)
    .where(eq(personRatings.personId, personId))
    .limit(1);
  if (!after[0]) throw new Error('Failed to ensure person rating row');
  return toPersonRow(after[0]);
};

export const ensureCompanyRating = async (
  exec: DbExecutor,
  companyId: string,
): Promise<CompanyRatingRow> => {
  const existing = await exec
    .select()
    .from(companyRatings)
    .where(eq(companyRatings.companyId, companyId))
    .limit(1);
  if (existing[0]) return toCompanyRow(existing[0]);

  const inserted = await exec
    .insert(companyRatings)
    .values({ companyId })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return toCompanyRow(inserted[0]);

  const after = await exec
    .select()
    .from(companyRatings)
    .where(eq(companyRatings.companyId, companyId))
    .limit(1);
  if (!after[0]) throw new Error('Failed to ensure company rating row');
  return toCompanyRow(after[0]);
};

export type PersonRatingPatch = Partial<
  Pick<
    PersonRatingRow,
    'base' | 'randomizer' | 'systemTopup' | 'manualTopup' | 'oscar' | 'penalties' | 'generated'
  >
>;

export type PersonRatingDelta = Partial<
  Pick<
    PersonRatingRow,
    'base' | 'randomizer' | 'systemTopup' | 'manualTopup' | 'oscar' | 'penalties' | 'generated'
  >
>;

const recomputePerson = (
  current: PersonRatingRow,
  patch: PersonRatingPatch,
): { next: PersonRatingRow; touchedPermanent: boolean } => {
  const merged = {
    base: patch.base ?? current.base,
    randomizer: patch.randomizer ?? current.randomizer,
    systemTopup: patch.systemTopup ?? current.systemTopup,
    manualTopup: patch.manualTopup ?? current.manualTopup,
    oscar: patch.oscar ?? current.oscar,
    penalties: patch.penalties ?? current.penalties,
  };
  const newNow = calcPersonNowPermanent(merged);
  const touchedPermanent =
    patch.base !== undefined ||
    patch.randomizer !== undefined ||
    patch.systemTopup !== undefined ||
    patch.manualTopup !== undefined ||
    patch.oscar !== undefined ||
    patch.penalties !== undefined;
  return {
    next: {
      ...current,
      ...merged,
      generated: patch.generated ?? current.generated,
      lastPermanent: touchedPermanent ? current.nowPermanent : current.lastPermanent,
      nowPermanent: touchedPermanent ? newNow : current.nowPermanent,
    },
    touchedPermanent,
  };
};

export const updatePersonRatingAbsolute = async (
  exec: DbExecutor,
  personId: string,
  patch: PersonRatingPatch,
): Promise<PersonRatingRow> => {
  const current = await ensurePersonRating(exec, personId);
  const { next, touchedPermanent } = recomputePerson(current, patch);
  const rows = await exec
    .update(personRatings)
    .set({
      base: next.base,
      randomizer: next.randomizer,
      systemTopup: next.systemTopup,
      manualTopup: next.manualTopup,
      oscar: next.oscar,
      penalties: next.penalties,
      generated: next.generated,
      ...(touchedPermanent && {
        lastPermanent: current.nowPermanent,
        nowPermanent: next.nowPermanent,
      }),
      updatedAt: sql`now()`,
    })
    .where(eq(personRatings.personId, personId))
    .returning();
  if (!rows[0]) throw new Error('Person rating disappeared during update');
  return toPersonRow(rows[0]);
};

export const applyPersonDelta = async (
  exec: DbExecutor,
  personId: string,
  delta: PersonRatingDelta,
): Promise<PersonRatingRow> => {
  const current = await ensurePersonRating(exec, personId);
  const patch: PersonRatingPatch = {};
  if (delta.base !== undefined) patch.base = current.base + delta.base;
  if (delta.randomizer !== undefined) patch.randomizer = current.randomizer + delta.randomizer;
  if (delta.systemTopup !== undefined) patch.systemTopup = current.systemTopup + delta.systemTopup;
  if (delta.manualTopup !== undefined) patch.manualTopup = current.manualTopup + delta.manualTopup;
  if (delta.oscar !== undefined) patch.oscar = current.oscar + delta.oscar;
  if (delta.penalties !== undefined) patch.penalties = current.penalties + delta.penalties;
  if (delta.generated !== undefined) patch.generated = current.generated + delta.generated;
  return updatePersonRatingAbsolute(exec, personId, patch);
};

export type CompanyRatingPatch = Partial<
  Pick<CompanyRatingRow, 'budget' | 'employeePermanent' | 'manualTopup' | 'oscar' | 'penalties'>
>;

export const updateCompanyRatingAbsolute = async (
  exec: DbExecutor,
  companyId: string,
  patch: CompanyRatingPatch,
): Promise<CompanyRatingRow> => {
  const current = await ensureCompanyRating(exec, companyId);
  const next = {
    budget: patch.budget ?? current.budget,
    employeePermanent: patch.employeePermanent ?? current.employeePermanent,
    manualTopup: patch.manualTopup ?? current.manualTopup,
    oscar: patch.oscar ?? current.oscar,
    penalties: patch.penalties ?? current.penalties,
  };
  const rows = await exec
    .update(companyRatings)
    .set({ ...next, updatedAt: sql`now()` })
    .where(eq(companyRatings.companyId, companyId))
    .returning();
  if (!rows[0]) throw new Error('Company rating disappeared during update');
  return toCompanyRow(rows[0]);
};

export const applyCompanyDelta = async (
  exec: DbExecutor,
  companyId: string,
  delta: CompanyRatingPatch,
): Promise<CompanyRatingRow> => {
  const current = await ensureCompanyRating(exec, companyId);
  const patch: CompanyRatingPatch = {};
  if (delta.budget !== undefined) patch.budget = current.budget + delta.budget;
  if (delta.employeePermanent !== undefined)
    patch.employeePermanent = current.employeePermanent + delta.employeePermanent;
  if (delta.manualTopup !== undefined) patch.manualTopup = current.manualTopup + delta.manualTopup;
  if (delta.oscar !== undefined) patch.oscar = current.oscar + delta.oscar;
  if (delta.penalties !== undefined) patch.penalties = current.penalties + delta.penalties;
  return updateCompanyRatingAbsolute(exec, companyId, patch);
};

export type InsertTransactionData = {
  donorPersonId?: string | null;
  donorCompanyId?: string | null;
  recipientPersonId?: string | null;
  recipientCompanyId?: string | null;
  amount: number;
  kind: RatingTxKind;
  comment?: string | null;
  authorUserId?: string | null;
};

export const insertTransaction = async (
  exec: DbExecutor,
  data: InsertTransactionData,
): Promise<RatingTransactionRow> => {
  const rows = await exec
    .insert(ratingTransactions)
    .values({
      donorPersonId: data.donorPersonId ?? null,
      donorCompanyId: data.donorCompanyId ?? null,
      recipientPersonId: data.recipientPersonId ?? null,
      recipientCompanyId: data.recipientCompanyId ?? null,
      amount: data.amount,
      kind: data.kind,
      comment: data.comment ?? null,
      authorUserId: data.authorUserId ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert rating transaction');
  return toTxRow(row);
};

export const listPersonHistory = async (
  exec: DbExecutor,
  personId: string,
  limit = 200,
  kind?: RatingTxKind,
  excludeKinds?: RatingTxKind[],
): Promise<RatingTransactionRow[]> => {
  const belongsToPerson = or(
    eq(ratingTransactions.donorPersonId, personId),
    eq(ratingTransactions.recipientPersonId, personId),
  );
  const rows = await exec
    .select()
    .from(ratingTransactions)
    // Фильтры по виду обязаны выполняться в SQL: иначе автоматические начисления
    // вытесняют содержательные записи из выборки ещё до фильтрации.
    .where(
      and(
        belongsToPerson,
        kind ? eq(ratingTransactions.kind, kind) : undefined,
        excludeKinds?.length ? notInArray(ratingTransactions.kind, excludeKinds) : undefined,
      ),
    )
    .orderBy(desc(ratingTransactions.createdAt))
    .limit(limit);
  return rows.map(toTxRow);
};

export const listCompanyHistory = async (
  exec: DbExecutor,
  companyId: string,
  limit = 200,
  kind?: RatingTxKind,
): Promise<RatingTransactionRow[]> => {
  const belongsToCompany = or(
    eq(ratingTransactions.donorCompanyId, companyId),
    eq(ratingTransactions.recipientCompanyId, companyId),
  );
  const rows = await exec
    .select()
    .from(ratingTransactions)
    .where(kind ? and(belongsToCompany, eq(ratingTransactions.kind, kind)) : belongsToCompany)
    .orderBy(desc(ratingTransactions.createdAt))
    .limit(limit);
  return rows.map(toTxRow);
};

export const listAllPersonRatings = async (exec: DbExecutor): Promise<PersonRatingRow[]> => {
  const rows = await exec.select().from(personRatings);
  return rows.map(toPersonRow);
};

export const listAllCompanyRatings = async (exec: DbExecutor): Promise<CompanyRatingRow[]> => {
  const rows = await exec.select().from(companyRatings);
  return rows.map(toCompanyRow);
};

export const listPersonRatingsForRandomizer = async (
  exec: DbExecutor,
): Promise<PersonRatingRow[]> => listAllPersonRatings(exec);

/**
 * Множество персонажей с активным постоянным контрактом — одним запросом,
 * чтобы считать статус Звезды для списков без запроса на каждую строку.
 */
export const listPersonIdsWithActivePermanent = async (exec: DbExecutor): Promise<Set<string>> => {
  const { permanentContracts } = await import('../../db/schema');
  const rows = await exec
    .select({ personId: permanentContracts.personId })
    .from(permanentContracts)
    .where(and(eq(permanentContracts.statusCode, 'confirmed'), isNull(permanentContracts.endedAt)));
  return new Set(rows.map((r) => r.personId));
};

export const findActivePermanentByPersonId = async (
  exec: DbExecutor,
  personId: string,
): Promise<boolean> => {
  // Re-export contract repo through service is awkward; use a lightweight SQL.
  // Imported lazily to avoid cyclic deps in tests.
  const { permanentContracts } = await import('../../db/schema');
  const rows = await exec
    .select({ id: permanentContracts.id })
    .from(permanentContracts)
    .where(
      and(
        eq(permanentContracts.personId, personId),
        eq(permanentContracts.statusCode, 'confirmed'),
        isNull(permanentContracts.endedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
};
