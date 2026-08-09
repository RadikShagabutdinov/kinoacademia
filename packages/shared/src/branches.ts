import { z } from '@hono/zod-openapi';

export const BRANCHES = ['cinema', 'farm', 'infra', 'other', 'jobless'] as const;

export const BranchCode = z.enum(BRANCHES);
export type BranchCode = z.infer<typeof BranchCode>;

export const BRANCH_LABELS: Record<BranchCode, string> = {
  cinema: 'Кинокомпании',
  farm: 'Большая фарма',
  infra: 'Инфраструктура отеля',
  other: 'Остальное',
  jobless: 'Без компании',
};
