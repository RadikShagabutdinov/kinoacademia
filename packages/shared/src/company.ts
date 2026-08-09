import { z } from '@hono/zod-openapi';
import { BranchCode } from './branches';
import { IsoDateTime, Uuid } from './common';

export const CompanyDto = z.object({
  id: Uuid,
  name: z.string().min(1).max(200),
  branchCode: BranchCode,
  headPersonId: Uuid.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type CompanyDto = z.infer<typeof CompanyDto>;

export const CreateCompanyInput = z.object({
  name: z.string().min(1).max(200),
  branchCode: BranchCode,
  headPersonId: Uuid.nullable().optional(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInput>;

export const UpdateCompanyInput = CreateCompanyInput.partial();
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInput>;
