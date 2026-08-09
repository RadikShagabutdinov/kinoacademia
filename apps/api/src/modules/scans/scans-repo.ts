import type { ContractKind } from '@kinoacademia/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { db } from '../../db/client';
import {
  companies,
  permanentContracts,
  scanPages,
  scanSets,
  temporaryContracts,
} from '../../db/schema';

export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export type ScanSetRow = {
  id: string;
  companyId: string;
  caption: string;
  createdByUserId: string | null;
  createdAt: Date;
};

export type ScanPageRow = {
  id: string;
  setId: string;
  orderIdx: number;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
};

export type ScanSetWithPagesRow = ScanSetRow & {
  pages: ScanPageRow[];
  contract: { kind: ContractKind; id: string } | null;
};

const toSetRow = (row: typeof scanSets.$inferSelect): ScanSetRow => ({
  id: row.id,
  companyId: row.companyId,
  caption: row.caption,
  createdByUserId: row.createdByUserId ?? null,
  createdAt: row.createdAt,
});

const toPageRow = (row: typeof scanPages.$inferSelect): ScanPageRow => ({
  id: row.id,
  setId: row.setId,
  orderIdx: row.orderIdx,
  filePath: row.filePath,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  uploadedAt: row.uploadedAt,
});

export const insertScanSet = async (
  exec: DbExecutor,
  data: { companyId: string; caption: string; createdByUserId: string | null },
): Promise<ScanSetRow> => {
  const rows = await exec
    .insert(scanSets)
    .values({
      companyId: data.companyId,
      caption: data.caption,
      createdByUserId: data.createdByUserId,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert scan_set');
  return toSetRow(row);
};

export const insertScanPage = async (
  exec: DbExecutor,
  data: {
    setId: string;
    orderIdx: number;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<ScanPageRow> => {
  const rows = await exec.insert(scanPages).values(data).returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to insert scan_page');
  return toPageRow(row);
};

const findPagesBySetId = async (exec: DbExecutor, setId: string): Promise<ScanPageRow[]> => {
  const rows = await exec
    .select()
    .from(scanPages)
    .where(eq(scanPages.setId, setId))
    .orderBy(asc(scanPages.orderIdx));
  return rows.map(toPageRow);
};

const findContractRefForSet = async (
  exec: DbExecutor,
  setId: string,
): Promise<{ kind: ContractKind; id: string } | null> => {
  const perm = await exec
    .select({ id: permanentContracts.id })
    .from(permanentContracts)
    .where(eq(permanentContracts.scanSetId, setId))
    .limit(1);
  if (perm[0]) return { kind: 'permanent', id: perm[0].id };
  const temp = await exec
    .select({ id: temporaryContracts.id })
    .from(temporaryContracts)
    .where(eq(temporaryContracts.scanSetId, setId))
    .limit(1);
  if (temp[0]) return { kind: 'temporary', id: temp[0].id };
  return null;
};

export const findScanSetWithPages = async (
  exec: DbExecutor,
  setId: string,
): Promise<ScanSetWithPagesRow | null> => {
  const rows = await exec.select().from(scanSets).where(eq(scanSets.id, setId)).limit(1);
  const setRow = rows[0];
  if (!setRow) return null;
  const [pages, contract] = await Promise.all([
    findPagesBySetId(exec, setId),
    findContractRefForSet(exec, setId),
  ]);
  return { ...toSetRow(setRow), pages, contract };
};

export const findScanPageById = async (
  exec: DbExecutor,
  pageId: string,
): Promise<(ScanPageRow & { companyId: string }) | null> => {
  const rows = await exec
    .select({
      page: scanPages,
      companyId: scanSets.companyId,
    })
    .from(scanPages)
    .innerJoin(scanSets, eq(scanSets.id, scanPages.setId))
    .where(eq(scanPages.id, pageId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...toPageRow(row.page), companyId: row.companyId };
};

export const listScanSetsByCompany = async (
  exec: DbExecutor,
  companyId: string,
): Promise<ScanSetWithPagesRow[]> => {
  const setRows = await exec
    .select()
    .from(scanSets)
    .where(eq(scanSets.companyId, companyId))
    .orderBy(desc(scanSets.createdAt));
  const result: ScanSetWithPagesRow[] = [];
  for (const s of setRows) {
    const [pages, contract] = await Promise.all([
      findPagesBySetId(exec, s.id),
      findContractRefForSet(exec, s.id),
    ]);
    result.push({ ...toSetRow(s), pages, contract });
  }
  return result;
};

export const deleteScanSet = async (exec: DbExecutor, setId: string): Promise<void> => {
  await exec.delete(scanSets).where(eq(scanSets.id, setId));
};

export const attachScanSetToContract = async (
  exec: DbExecutor,
  contractKind: ContractKind,
  contractId: string,
  setId: string,
): Promise<boolean> => {
  const table = contractKind === 'permanent' ? permanentContracts : temporaryContracts;
  const rows = await exec
    .update(table)
    .set({ scanSetId: setId })
    .where(eq(table.id, contractId))
    .returning({ id: table.id });
  return rows.length > 0;
};

export const findContractCompanyId = async (
  exec: DbExecutor,
  contractKind: ContractKind,
  contractId: string,
): Promise<string | null> => {
  const table = contractKind === 'permanent' ? permanentContracts : temporaryContracts;
  const rows = await exec
    .select({ companyId: table.companyId })
    .from(table)
    .where(eq(table.id, contractId))
    .limit(1);
  return rows[0]?.companyId ?? null;
};

export const findSystemCompanyId = async (exec: DbExecutor = db): Promise<string | null> => {
  const rows = await exec
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.isSystem, true))
    .limit(1);
  return rows[0]?.id ?? null;
};

export const findCompanyById = async (
  exec: DbExecutor,
  companyId: string,
): Promise<{ id: string; isSystem: boolean } | null> => {
  const rows = await exec
    .select({ id: companies.id, isSystem: companies.isSystem })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return rows[0] ?? null;
};

export const findContractPersonAndCompany = async (
  exec: DbExecutor,
  contractKind: ContractKind,
  contractId: string,
): Promise<{ personId: string; companyId: string } | null> => {
  const table = contractKind === 'permanent' ? permanentContracts : temporaryContracts;
  const rows = await exec
    .select({ personId: table.personId, companyId: table.companyId })
    .from(table)
    .where(eq(table.id, contractId))
    .limit(1);
  return rows[0] ?? null;
};

// Обходной хелпер для тестов
export const _testables = { and, eq };
