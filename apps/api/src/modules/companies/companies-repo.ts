import type { BranchCode, CompanyDto } from '@kinoacademia/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { companies, persons } from '../../db/schema';

export type CompanyRow = {
  id: string;
  name: string;
  branchCode: BranchCode;
  headPersonId: string | null;
  /** Служебная компания-контейнер для типовых сканов: не имеет главы и контрактов. */
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const toRow = (row: typeof companies.$inferSelect): CompanyRow => ({
  id: row.id,
  name: row.name,
  branchCode: row.branchCode as BranchCode,
  headPersonId: row.headPersonId ?? null,
  isSystem: row.isSystem,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toCompanyDto = (row: CompanyRow): CompanyDto => ({
  id: row.id,
  name: row.name,
  branchCode: row.branchCode,
  headPersonId: row.headPersonId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type ListCompaniesFilter = {
  branchCode?: BranchCode;
};

export const listCompanies = async (filter: ListCompaniesFilter = {}): Promise<CompanyRow[]> => {
  const conditions = [];
  if (filter.branchCode !== undefined) {
    conditions.push(eq(companies.branchCode, filter.branchCode));
  }
  const rows = await db
    .select()
    .from(companies)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(companies.name);
  return rows.map(toRow);
};

export const findCompanyById = async (id: string): Promise<CompanyRow | null> => {
  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
};

export const findCompanyByHeadUserId = async (userId: string): Promise<CompanyRow | null> => {
  const rows = await db
    .select({ company: companies })
    .from(companies)
    .innerJoin(persons, eq(persons.id, companies.headPersonId))
    .where(and(eq(persons.userId, userId), eq(persons.isOpen, true), eq(companies.isSystem, false)))
    .limit(1);
  return rows[0] ? toRow(rows[0].company) : null;
};

export type CreateCompanyData = {
  name: string;
  branchCode: BranchCode;
  headPersonId?: string | null;
};

export const createCompany = async (data: CreateCompanyData): Promise<CompanyRow> => {
  const rows = await db
    .insert(companies)
    .values({
      name: data.name,
      branchCode: data.branchCode,
      headPersonId: data.headPersonId ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('Failed to create company');
  return toRow(row);
};

export type UpdateCompanyData = {
  name?: string;
  branchCode?: BranchCode;
  headPersonId?: string | null;
};

export const updateCompany = async (
  id: string,
  data: UpdateCompanyData,
): Promise<CompanyRow | null> => {
  const rows = await db
    .update(companies)
    .set({
      ...data,
      updatedAt: sql`now()`,
    })
    .where(eq(companies.id, id))
    .returning();
  return rows[0] ? toRow(rows[0]) : null;
};
