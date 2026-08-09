import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';
import { ContractKind } from './contract';

export const SCAN_MAX_PAGES = 4;
export const SCAN_MAX_FILE_SIZE = 10 * 1024 * 1024;

export const SCAN_ALLOWED_MIME = ['image/jpeg', 'application/pdf'] as const;
export const ScanMime = z.enum(SCAN_ALLOWED_MIME);
export type ScanMime = z.infer<typeof ScanMime>;

export const ScanPageDto = z.object({
  id: Uuid,
  setId: Uuid,
  orderIdx: z
    .number()
    .int()
    .min(0)
    .max(SCAN_MAX_PAGES - 1),
  mimeType: ScanMime,
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: IsoDateTime,
});
export type ScanPageDto = z.infer<typeof ScanPageDto>;

export const ScanSetDto = z.object({
  id: Uuid,
  companyId: Uuid,
  caption: z.string(),
  createdByUserId: Uuid.nullable(),
  createdAt: IsoDateTime,
  pages: z.array(ScanPageDto),
  contract: z
    .object({
      kind: ContractKind,
      id: Uuid,
    })
    .nullable(),
});
export type ScanSetDto = z.infer<typeof ScanSetDto>;

export const ScanContractRef = z.object({
  kind: ContractKind,
  id: Uuid,
});
export type ScanContractRef = z.infer<typeof ScanContractRef>;

export const CreateScanSetInput = z.object({
  companyId: Uuid,
  caption: z.string().trim().min(1).max(200),
  contract: ScanContractRef.optional(),
});
export type CreateScanSetInput = z.infer<typeof CreateScanSetInput>;

export const SCAN_ERROR_CODES = [
  'invalid_mime',
  'too_large',
  'too_many_pages',
  'no_files',
  'forbidden',
  'not_found',
  'company_mismatch',
] as const;
export const ScanErrorCode = z.enum(SCAN_ERROR_CODES);
export type ScanErrorCode = z.infer<typeof ScanErrorCode>;
