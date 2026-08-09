import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';

// TODO: Согласовать итоговый размер штрафа за односторонний разрыв постоянного
// контракта персонажем (см. документацию по контрактам).
export const BREAKUP_PENALTY = 100;

/**
 * Пороговые значения постоянного рейтинга для статуса «Звезда».
 * См. PROJECT.md → раздел «Статус Звезда».
 */
export const STAR_RATING_FULL = 1000;
export const STAR_RATING_WITH_CONTRACT = 500;

/** Во сколько раз Звезда усиливает свой перевод восхищения другому персонажу. */
export const STAR_BONUS_MULTIPLIER = 5;

export const computeIsStar = (
  nowPermanent: number,
  hasActivePermanentContract: boolean,
): boolean => {
  if (nowPermanent >= STAR_RATING_FULL) return true;
  if (hasActivePermanentContract && nowPermanent >= STAR_RATING_WITH_CONTRACT) return true;
  return false;
};

export const RATING_TX_KINDS = [
  'variable_to_permanent',
  'randomizer',
  'manual',
  'oscar',
  'penalty',
  'star_bonus',
  'generated',
  'base',
  'budget',
] as const;
export const RatingTxKind = z.enum(RATING_TX_KINDS);
export type RatingTxKind = z.infer<typeof RatingTxKind>;

/**
 * Игровая разбивка рейтинга персонажа. Секретный мастерский модификатор
 * (`person_ratings.randomizer`) здесь не отдельная составляющая, а уже свёрнут
 * в `base`: игроку не должно быть видно, что такой модификатор существует.
 */
export const PersonRatingDto = z.object({
  personId: Uuid,
  generated: z.number().int(),
  nowPermanent: z.number().int(),
  lastPermanent: z.number().int(),
  base: z.number().int(),
  systemTopup: z.number().int(),
  manualTopup: z.number().int(),
  oscar: z.number().int(),
  penalties: z.number().int(),
  isStar: z.boolean(),
  updatedAt: IsoDateTime,
});
export type PersonRatingDto = z.infer<typeof PersonRatingDto>;

/**
 * Полная разбивка для админки: `base` — «честная» база без модификатора,
 * `randomizer` — сам модификатор. Отдаётся только по admin-эндпоинтам.
 */
export const PersonRatingAdminDto = PersonRatingDto.extend({
  randomizer: z.number().int(),
});
export type PersonRatingAdminDto = z.infer<typeof PersonRatingAdminDto>;

// Укороченная версия рейтинга персонажа без разбивки по составляющим —
// используется для "встречной проверки рейтинга" другого персонажа (приватность).
export const PersonRatingSummaryDto = z.object({
  personId: Uuid,
  nowPermanent: z.number().int(),
  isStar: z.boolean(),
});
export type PersonRatingSummaryDto = z.infer<typeof PersonRatingSummaryDto>;

export const CompanyRatingDto = z.object({
  companyId: Uuid,
  budget: z.number().int(),
  employeePermanent: z.number().int(),
  manualTopup: z.number().int(),
  oscar: z.number().int(),
  penalties: z.number().int(),
  updatedAt: IsoDateTime,
});
export type CompanyRatingDto = z.infer<typeof CompanyRatingDto>;

export const RatingTransactionDto = z.object({
  id: Uuid,
  donorPersonId: Uuid.nullable(),
  donorCompanyId: Uuid.nullable(),
  recipientPersonId: Uuid.nullable(),
  recipientCompanyId: Uuid.nullable(),
  amount: z.number().int(),
  kind: RatingTxKind,
  comment: z.string().nullable(),
  authorUserId: Uuid.nullable(),
  createdAt: IsoDateTime,
});
export type RatingTransactionDto = z.infer<typeof RatingTransactionDto>;

export const TransferRatingInput = z
  .object({
    recipientPersonId: Uuid,
    amount: z.number().int().positive(),
    comment: z.string().max(500).optional(),
  })
  .strict();
export type TransferRatingInput = z.infer<typeof TransferRatingInput>;

export const ManualRatingMode = z.enum(['absolute', 'percent']);
export type ManualRatingMode = z.infer<typeof ManualRatingMode>;

/**
 * `base` — стартовый («базовый») рейтинг персонажа, `budget` — бюджет компании.
 * Оба вносятся только администратором и всегда абсолютной величиной.
 */
export const ManualRatingKind = z.enum(['manual', 'oscar', 'penalty', 'base', 'budget']);
export type ManualRatingKind = z.infer<typeof ManualRatingKind>;

// Процент считается от nowPermanent персонажа или employeePermanent компании.
export const ManualRatingInput = z
  .object({
    targetPersonId: Uuid.optional(),
    targetCompanyId: Uuid.optional(),
    amount: z.number().int(),
    mode: ManualRatingMode.default('absolute'),
    kind: ManualRatingKind.default('manual'),
    comment: z.string().max(500).optional(),
  })
  .refine((v) => Boolean(v.targetPersonId) !== Boolean(v.targetCompanyId), {
    message: 'Specify exactly one of targetPersonId / targetCompanyId',
  })
  .refine((v) => v.kind !== 'base' || Boolean(v.targetPersonId), {
    message: 'Kind "base" applies to a person only',
  })
  .refine((v) => v.kind !== 'budget' || Boolean(v.targetCompanyId), {
    message: 'Kind "budget" applies to a company only',
  })
  // Бюджет компании и база персонажа вносятся абсолютной величиной: бюджет вообще
  // не входит в постоянный рейтинг, а база задаёт его отправную точку.
  .refine((v) => (v.kind !== 'base' && v.kind !== 'budget') || v.mode === 'absolute', {
    message: 'Kinds "base" and "budget" support absolute mode only',
  });
export type ManualRatingInput = z.infer<typeof ManualRatingInput>;

export const RandomizerEntry = z.object({
  personId: Uuid,
  value: z.number().int(),
});
export type RandomizerEntry = z.infer<typeof RandomizerEntry>;

export const RandomizerApplyInput = z
  .object({
    values: z.array(RandomizerEntry).min(1),
  })
  .strict();
export type RandomizerApplyInput = z.infer<typeof RandomizerApplyInput>;

export const RatingHistoryQuery = z
  .object({
    limit: z.coerce.number().int().positive().max(500).optional(),
    kind: RatingTxKind.optional(),
  })
  .strict();
export type RatingHistoryQuery = z.infer<typeof RatingHistoryQuery>;
