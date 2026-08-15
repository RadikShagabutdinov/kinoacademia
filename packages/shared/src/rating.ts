import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';

/**
 * Потолок вклада одного сотрудника в одно начисление капитализации компании.
 * Ограничение защищает от гиперкапитализации: Звезда с рейтингом 1000 приносит
 * компании те же 100 пунктов за начисление, что и сотрудник со 100.
 */
export const CAPITALIZATION_PER_EMPLOYEE_CAP = 100;

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

/** Доля постоянного рейтинга, теряемая персонажем при одностороннем разрыве. */
export const BREAKUP_PENALTY_PERCENT_STAR = 50;
export const BREAKUP_PENALTY_PERCENT_REGULAR = 25;

/**
 * Штраф за односторонний разрыв постоянного контракта: процент от постоянного
 * рейтинга персонажа, посчитанного без скрытого мастерского модификатора
 * (рандомайзера). Нулевой или отрицательный рейтинг штрафа не даёт.
 */
export const computeBreakupPenalty = (
  permanentWithoutRandomizer: number,
  isStar: boolean,
): number => {
  if (permanentWithoutRandomizer <= 0) return 0;
  const percent = isStar ? BREAKUP_PENALTY_PERCENT_STAR : BREAKUP_PENALTY_PERCENT_REGULAR;
  return Math.round((permanentWithoutRandomizer * percent) / 100);
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

/**
 * `nowPermanent` — постоянный рейтинг компании (капитализация + ручные + Оскар +
 * штрафы, полученные при разрыве контрактов); `lastPermanent` — его значение до
 * последней операции. `budget` в постоянный рейтинг не входит.
 */
export const CompanyRatingDto = z.object({
  companyId: Uuid,
  budget: z.number().int(),
  nowPermanent: z.number().int(),
  lastPermanent: z.number().int(),
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
 * Абсолютная величина процентного перевода. Процентом платит только компания со
 * своего постоянного счёта, поэтому база — её `nowPermanent`. Формула общая для
 * формы (предпросмотр суммы) и сервера, чтобы предпросмотр совпадал с транзакцией.
 */
export const computePercentAmount = (percent: number, base: number): number =>
  Math.round((base * percent) / 100);

/**
 * Часть рейтинга, участвующая в ручной транзакции: у персонажа это постоянный
 * или переменный рейтинг, у компании — постоянный рейтинг или бюджет.
 */
export const RATING_SLOTS = ['permanent', 'variable', 'budget'] as const;
export const RatingSlot = z.enum(RATING_SLOTS);
export type RatingSlot = z.infer<typeof RatingSlot>;

export const PERSON_RATING_SLOTS: readonly RatingSlot[] = ['permanent', 'variable'];
export const COMPANY_RATING_SLOTS: readonly RatingSlot[] = ['permanent', 'budget'];

const SLOTS_BY_SIDE: Record<'person' | 'company', readonly RatingSlot[]> = {
  person: PERSON_RATING_SLOTS,
  company: COMPANY_RATING_SLOTS,
};

export const isRatingSlotAllowed = (side: 'person' | 'company', slot: RatingSlot): boolean =>
  SLOTS_BY_SIDE[side].includes(slot);

/**
 * Составляющая постоянного рейтинга, в которую попадает начисление.
 * `base` — стартовый («базовый») рейтинг персонажа, вносится только абсолютной величиной.
 */
export const ManualRatingKind = z.enum(['manual', 'oscar', 'penalty', 'base']);
export type ManualRatingKind = z.infer<typeof ManualRatingKind>;

/** Кому начисляем: сущность, часть рейтинга и — для постоянного — его составляющая. */
export const ManualRatingTarget = z
  .object({
    personId: Uuid.optional(),
    companyId: Uuid.optional(),
    slot: RatingSlot,
    kind: ManualRatingKind.default('manual'),
  })
  .strict();
export type ManualRatingTarget = z.infer<typeof ManualRatingTarget>;

/**
 * Откуда берём. Составляющей у источника нет: постоянный рейтинг всегда списывается
 * из «ручной» составляющей — иначе пришлось бы «снимать оскар» или «снимать базу».
 */
export const ManualRatingSource = z
  .object({
    personId: Uuid.optional(),
    companyId: Uuid.optional(),
    slot: RatingSlot,
  })
  .strict();
export type ManualRatingSource = z.infer<typeof ManualRatingSource>;

const sideKind = (side: {
  personId?: string | undefined;
  companyId?: string | undefined;
}): 'person' | 'company' | null => {
  if (Boolean(side.personId) === Boolean(side.companyId)) return null;
  return side.personId ? 'person' : 'company';
};

/**
 * Ручная транзакция админа. Без `from` рейтинг берётся из неисчерпаемого админского
 * ресурса, с `from` — списывается у указанного персонажа/компании. Процентом платит
 * только компания со своего постоянного счёта: база процента — её постоянный рейтинг.
 */
export const ManualRatingInput = z
  .object({
    to: ManualRatingTarget,
    from: ManualRatingSource.optional(),
    amount: z.number().int(),
    mode: ManualRatingMode.default('absolute'),
    comment: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const toKind = sideKind(v.to);
    if (!toKind) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Specify exactly one of personId / companyId',
      });
    } else if (!isRatingSlotAllowed(toKind, v.to.slot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['to', 'slot'],
        message: `Slot "${v.to.slot}" is not applicable to a ${toKind}`,
      });
    }

    if (v.to.kind === 'base' && (toKind !== 'person' || v.to.slot !== 'permanent')) {
      ctx.addIssue({
        code: 'custom',
        path: ['to', 'kind'],
        message: 'Kind "base" applies to a person permanent rating only',
      });
    }
    // База задаёт отправную точку постоянного рейтинга — её вносят числом.
    if (v.to.kind === 'base' && v.mode !== 'absolute') {
      ctx.addIssue({
        code: 'custom',
        path: ['mode'],
        message: 'Kind "base" supports absolute mode only',
      });
    }
    // Процентом платит только компания со своего постоянного счёта: у остальных
    // сторон нет величины, от которой процент был бы осмыслен.
    if (
      v.mode === 'percent' &&
      !(v.from !== undefined && Boolean(v.from.companyId) && v.from.slot === 'permanent')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['mode'],
        message: 'Percent mode requires a company permanent-rating source',
      });
    }

    if (!v.from) {
      if (v.amount === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'Amount must be non-zero',
        });
      }
      return;
    }

    const fromKind = sideKind(v.from);
    if (!fromKind) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Specify exactly one of personId / companyId',
      });
    } else if (!isRatingSlotAllowed(fromKind, v.from.slot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['from', 'slot'],
        message: `Slot "${v.from.slot}" is not applicable to a ${fromKind}`,
      });
    }

    // Переменный рейтинг персонажа — «пропуск» на игровые действия, его выдаёт
    // только мастер: переливать в него чужой рейтинг нельзя.
    if (v.to.slot === 'variable') {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Variable rating can only be credited from admin resources',
      });
    }
    if (v.amount <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Amount must be positive when a source is specified',
      });
    }
    const sameEntity =
      (v.from.personId !== undefined && v.from.personId === v.to.personId) ||
      (v.from.companyId !== undefined && v.from.companyId === v.to.companyId);
    if (sameEntity && v.from.slot === v.to.slot) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Source and target must differ',
      });
    }
  });
export type ManualRatingInput = z.infer<typeof ManualRatingInput>;

/**
 * Выплата руководителя из бюджета компании в постоянный рейтинг получателя —
 * зарплата сотрудникам и прочие расходы. Получатель — один: персонаж или компания.
 */
export const CompanyPaymentInput = z
  .object({
    recipientPersonId: Uuid.optional(),
    recipientCompanyId: Uuid.optional(),
    amount: z.number().int().positive(),
    comment: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (Boolean(v.recipientPersonId) === Boolean(v.recipientCompanyId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Specify exactly one of recipientPersonId / recipientCompanyId',
      });
    }
  });
export type CompanyPaymentInput = z.infer<typeof CompanyPaymentInput>;

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
