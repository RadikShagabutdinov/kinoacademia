import type {
  BranchCode,
  ContractKind,
  ContractSide,
  ContractStatusCode,
} from '@kinoacademia/shared';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  companies,
  contractStatusHistory,
  permanentContracts,
  persons,
  temporaryContracts,
} from '../../db/schema';

export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export type ContractRow = {
  id: string;
  kind: ContractKind;
  personId: string;
  companyId: string;
  statusCode: ContractStatusCode;
  startedAt: Date | null;
  endedAt: Date | null;
  breakupInitiatedBy: ContractSide | null;
  createdAt: Date;
  updatedAt: Date;
};

const tableFor = (kind: ContractKind) =>
  kind === 'permanent' ? permanentContracts : temporaryContracts;

const toRow = (kind: ContractKind, row: typeof permanentContracts.$inferSelect): ContractRow => ({
  id: row.id,
  kind,
  personId: row.personId,
  companyId: row.companyId,
  statusCode: row.statusCode as ContractStatusCode,
  startedAt: row.startedAt ?? null,
  endedAt: row.endedAt ?? null,
  breakupInitiatedBy: (row.breakupInitiatedBy ?? null) as ContractSide | null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const findContract = async (
  exec: DbExecutor,
  kind: ContractKind,
  id: string,
): Promise<ContractRow | null> => {
  const table = tableFor(kind);
  const rows = await exec.select().from(table).where(eq(table.id, id)).limit(1);
  return rows[0] ? toRow(kind, rows[0]) : null;
};

/**
 * Статусы уже заключённого, действующего контракта. Отличаются от
 * `ACTIVE_CONTRACT_STATUSES`: непринятое предложение (`draft`/`sent`) действующим
 * контрактом не является и не должно попадать под авто-разрыв.
 */
const EFFECTIVE_STATUSES: ContractStatusCode[] = ['confirmed', 'breakup_sent', 'breakup_rejected'];

export const findEffectivePermanentByPerson = async (
  exec: DbExecutor,
  personId: string,
): Promise<ContractRow | null> => {
  const rows = await exec
    .select()
    .from(permanentContracts)
    .where(
      and(
        eq(permanentContracts.personId, personId),
        isNull(permanentContracts.endedAt),
        inArray(permanentContracts.statusCode, EFFECTIVE_STATUSES),
      ),
    )
    .limit(1);
  return rows[0] ? toRow('permanent', rows[0]) : null;
};

export const findEffectiveTemporary = async (
  exec: DbExecutor,
  personId: string,
  companyId: string,
): Promise<ContractRow | null> => {
  const rows = await exec
    .select()
    .from(temporaryContracts)
    .where(
      and(
        eq(temporaryContracts.personId, personId),
        eq(temporaryContracts.companyId, companyId),
        isNull(temporaryContracts.endedAt),
        inArray(temporaryContracts.statusCode, EFFECTIVE_STATUSES),
      ),
    )
    .limit(1);
  return rows[0] ? toRow('temporary', rows[0]) : null;
};

export const findActivePermanentByPersonCompany = async (
  exec: DbExecutor,
  personId: string,
  companyId: string,
): Promise<ContractRow | null> => {
  const rows = await exec
    .select()
    .from(permanentContracts)
    .where(
      and(
        eq(permanentContracts.personId, personId),
        eq(permanentContracts.companyId, companyId),
        isNull(permanentContracts.endedAt),
      ),
    )
    .limit(1);
  return rows[0] ? toRow('permanent', rows[0]) : null;
};

export const findActiveTemporary = async (
  exec: DbExecutor,
  personId: string,
  companyId: string,
): Promise<ContractRow | null> => {
  const rows = await exec
    .select()
    .from(temporaryContracts)
    .where(
      and(
        eq(temporaryContracts.personId, personId),
        eq(temporaryContracts.companyId, companyId),
        isNull(temporaryContracts.endedAt),
      ),
    )
    .limit(1);
  return rows[0] ? toRow('temporary', rows[0]) : null;
};

export type InsertContractData = {
  personId: string;
  companyId: string;
  statusCode: ContractStatusCode;
};

export const insertContract = async (
  exec: DbExecutor,
  kind: ContractKind,
  data: InsertContractData,
): Promise<ContractRow> => {
  const table = tableFor(kind);
  const rows = await exec
    .insert(table)
    .values({
      personId: data.personId,
      companyId: data.companyId,
      statusCode: data.statusCode,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert contract');
  return toRow(kind, row);
};

export type UpdateContractData = {
  statusCode: ContractStatusCode;
  startedAt?: Date | null;
  endedAt?: Date | null;
  breakupInitiatedBy?: ContractSide | null;
};

export const updateContractStatus = async (
  exec: DbExecutor,
  kind: ContractKind,
  id: string,
  data: UpdateContractData,
): Promise<ContractRow | null> => {
  const table = tableFor(kind);
  const rows = await exec
    .update(table)
    .set({
      statusCode: data.statusCode,
      ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
      ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
      ...(data.breakupInitiatedBy !== undefined && {
        breakupInitiatedBy: data.breakupInitiatedBy,
      }),
      updatedAt: sql`now()`,
    })
    .where(eq(table.id, id))
    .returning();
  return rows[0] ? toRow(kind, rows[0]) : null;
};

export type InsertHistoryData = {
  contractId: string;
  contractKind: ContractKind;
  fromStatusCode: ContractStatusCode | null;
  toStatusCode: ContractStatusCode;
  changedByUserId: string | null;
  comment?: string | null;
};

export const insertHistory = async (exec: DbExecutor, data: InsertHistoryData): Promise<void> => {
  await exec.insert(contractStatusHistory).values({
    contractId: data.contractId,
    contractKind: data.contractKind,
    fromStatusCode: data.fromStatusCode,
    toStatusCode: data.toStatusCode,
    changedByUserId: data.changedByUserId,
    comment: data.comment ?? null,
  });
};

export const listContractsByPerson = async (
  exec: DbExecutor,
  personId: string,
): Promise<ContractRow[]> => {
  const [perms, temps] = await Promise.all([
    exec.select().from(permanentContracts).where(eq(permanentContracts.personId, personId)),
    exec.select().from(temporaryContracts).where(eq(temporaryContracts.personId, personId)),
  ]);
  return [
    ...perms.map((r) => toRow('permanent', r)),
    ...temps.map((r) => toRow('temporary', r)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export type ContractHistoryRow = {
  id: string;
  contractId: string;
  contractKind: ContractKind;
  fromStatusCode: ContractStatusCode | null;
  toStatusCode: ContractStatusCode;
  changedAt: Date;
  changedByUserId: string | null;
  comment: string | null;
  companyId: string;
  companyName: string;
  branchCode: BranchCode;
  personId: string;
  personDisplayName: string;
};

export type ListStatusHistoryFilter = {
  companyId?: string;
  personId?: string;
  branchCode?: BranchCode;
  limit?: number;
};

/**
 * Возвращает историю переходов статусов контрактов с join по компании и персонажу.
 * `contract_status_history` хранит `contractId`+`contractKind` без FK, поэтому
 * соединяем через LEFT JOIN с обеими таблицами и берём первое непустое значение.
 */
export const listStatusHistory = async (
  exec: DbExecutor,
  filter: ListStatusHistoryFilter = {},
): Promise<ContractHistoryRow[]> => {
  const limit = filter.limit ?? 200;

  const personIdExpr = sql<string>`coalesce(${permanentContracts.personId}, ${temporaryContracts.personId})`;
  const companyIdExpr = sql<string>`coalesce(${permanentContracts.companyId}, ${temporaryContracts.companyId})`;

  // Строки-«сироты» (контракт удалён, компания/персонаж не нашлись) отсеиваем в SQL,
  // а не после выборки: иначе LIMIT считает их и клиент получает меньше строк, чем просил.
  const conditions = [isNotNull(companies.id), isNotNull(persons.id)] as ReturnType<typeof eq>[];
  if (filter.companyId) {
    conditions.push(
      sql`coalesce(${permanentContracts.companyId}, ${temporaryContracts.companyId}) = ${filter.companyId}` as unknown as ReturnType<
        typeof eq
      >,
    );
  }
  if (filter.personId) {
    conditions.push(
      sql`coalesce(${permanentContracts.personId}, ${temporaryContracts.personId}) = ${filter.personId}` as unknown as ReturnType<
        typeof eq
      >,
    );
  }
  if (filter.branchCode) {
    conditions.push(eq(companies.branchCode, filter.branchCode));
  }

  const rows = await exec
    .select({
      id: contractStatusHistory.id,
      contractId: contractStatusHistory.contractId,
      contractKind: contractStatusHistory.contractKind,
      fromStatusCode: contractStatusHistory.fromStatusCode,
      toStatusCode: contractStatusHistory.toStatusCode,
      changedAt: contractStatusHistory.changedAt,
      changedByUserId: contractStatusHistory.changedByUserId,
      comment: contractStatusHistory.comment,
      personId: personIdExpr,
      companyId: companyIdExpr,
      companyName: companies.name,
      branchCode: companies.branchCode,
      personDisplayName: persons.displayName,
    })
    .from(contractStatusHistory)
    .leftJoin(
      permanentContracts,
      and(
        eq(contractStatusHistory.contractKind, 'permanent'),
        eq(permanentContracts.id, contractStatusHistory.contractId),
      ),
    )
    .leftJoin(
      temporaryContracts,
      and(
        eq(contractStatusHistory.contractKind, 'temporary'),
        eq(temporaryContracts.id, contractStatusHistory.contractId),
      ),
    )
    .leftJoin(companies, eq(companies.id, companyIdExpr))
    .leftJoin(persons, eq(persons.id, personIdExpr))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contractStatusHistory.changedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    contractId: r.contractId,
    contractKind: r.contractKind as ContractKind,
    fromStatusCode: (r.fromStatusCode ?? null) as ContractStatusCode | null,
    toStatusCode: r.toStatusCode as ContractStatusCode,
    changedAt: r.changedAt,
    changedByUserId: r.changedByUserId,
    comment: r.comment,
    companyId: r.companyId as string,
    companyName: r.companyName ?? '',
    branchCode: (r.branchCode ?? 'other') as BranchCode,
    personId: r.personId as string,
    personDisplayName: r.personDisplayName ?? '',
  }));
};

export const listContractsByCompany = async (
  exec: DbExecutor,
  companyId: string,
): Promise<ContractRow[]> => {
  const [perms, temps] = await Promise.all([
    exec.select().from(permanentContracts).where(eq(permanentContracts.companyId, companyId)),
    exec.select().from(temporaryContracts).where(eq(temporaryContracts.companyId, companyId)),
  ]);
  return [
    ...perms.map((r) => toRow('permanent', r)),
    ...temps.map((r) => toRow('temporary', r)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

const ACTIVE_STATUSES: ContractStatusCode[] = [
  'draft',
  'sent',
  'confirmed',
  'breakup_sent',
  'breakup_rejected',
];

export const listActiveContracts = async (exec: DbExecutor): Promise<ContractRow[]> => {
  const [perms, temps] = await Promise.all([
    exec
      .select()
      .from(permanentContracts)
      .where(
        and(
          isNull(permanentContracts.endedAt),
          inArray(permanentContracts.statusCode, ACTIVE_STATUSES),
        ),
      ),
    exec
      .select()
      .from(temporaryContracts)
      .where(
        and(
          isNull(temporaryContracts.endedAt),
          inArray(temporaryContracts.statusCode, ACTIVE_STATUSES),
        ),
      ),
  ]);
  return [
    ...perms.map((r) => toRow('permanent', r)),
    ...temps.map((r) => toRow('temporary', r)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};
