import { z } from '@hono/zod-openapi';

export const RACES = ['homo', 'vamp', 'wolf', 'corv', 'vamp-corv', 'wolf-corv'] as const;

export const RaceCode = z.enum(RACES);
export type RaceCode = z.infer<typeof RaceCode>;

export const RACE_LABELS: Record<RaceCode, string> = {
  homo: 'Человек',
  vamp: 'Вампир',
  wolf: 'Ликан',
  corv: 'Корвинус',
  'vamp-corv': 'Вампир-Корвинус',
  'wolf-corv': 'Ликан-Корвинус',
};
