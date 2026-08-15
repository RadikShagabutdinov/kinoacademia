import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';
import type { FilmRole } from './film';

export const OSCAR_WIN_PERSON_BONUS = 200;
export const OSCAR_WIN_COMPANY_BONUS = 500;

// Стоимость подачи номинации растёт с числом уже поданных компанией номинаций:
// первая бесплатна, 2-я и 3-я — по 100, 4-я — 200, все дальнейшие — по 300.
export const NOMINATION_COST_TIERS = [0, 100, 100, 200] as const;
export const NOMINATION_COST_BEYOND = 300;

/** Стоимость следующей номинации компании; `previousCount` — сколько уже подано. */
export const computeNominationCost = (previousCount: number): number =>
  NOMINATION_COST_TIERS[previousCount] ?? NOMINATION_COST_BEYOND;

export const NOMINATIONS = [
  'best_film',
  'best_actor',
  'best_actress',
  'best_role_2',
  'best_script',
  'best_camera',
  'best_visual',
  'contribution',
] as const;
export const NominationCode = z.enum(NOMINATIONS);
export type NominationCode = z.infer<typeof NominationCode>;

export const NOMINATION_LABELS: Record<NominationCode, string> = {
  best_film: 'Лучший фильм',
  best_actor: 'Лучший актёр 1-го плана',
  best_actress: 'Лучшая актриса 1-го плана',
  best_role_2: 'Лучшая роль 2-го плана',
  best_script: 'Лучший сценарий',
  best_camera: 'Лучшая операторская работа',
  best_visual: 'Лучшая работа с визуальным наполнением',
  contribution: 'За вклад в киноискусство',
};

export const OscarDto = z.object({
  id: Uuid,
  filmId: Uuid.nullable(),
  personId: Uuid.nullable(),
  nominationCode: NominationCode,
  isWinner: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type OscarDto = z.infer<typeof OscarDto>;

export const CreateOscarNominationInput = z.object({
  filmId: Uuid.nullable().optional(),
  personId: Uuid.nullable().optional(),
  nominationCode: NominationCode,
});
export type CreateOscarNominationInput = z.infer<typeof CreateOscarNominationInput>;

// Соответствие номинации и роли участника фильма. Для `contribution` роль не
// нужна — это закрытая «За вклад в киноискусство», присуждается админом
// напрямую персонажу (без фильма).
export const NOMINATION_TO_FILM_ROLE: Record<NominationCode, FilmRole | null> = {
  best_film: 'director',
  best_actor: 'actor_lead_male',
  best_actress: 'actress_lead_female',
  best_role_2: 'actor_supporting',
  best_script: 'screenwriter',
  best_camera: 'cinematographer',
  best_visual: 'visual_artist',
  contribution: null,
};

export const isCinemaOnlyNomination = (code: NominationCode): boolean => code !== 'contribution';

// Расширенный DTO для UI: номинация + join-поля (название фильма, имена,
// компания-создатель). Возвращается из listForInfo / listForAdmin / выборок.
export const OscarNominationDetailDto = z.object({
  id: Uuid,
  filmId: Uuid.nullable(),
  filmTitle: z.string().nullable(),
  personId: Uuid.nullable(),
  personName: z.string().nullable(),
  companyId: Uuid.nullable(),
  companyName: z.string().nullable(),
  nominationCode: NominationCode,
  isWinner: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type OscarNominationDetailDto = z.infer<typeof OscarNominationDetailDto>;

// Результат отзыва номинации: сколько рейтинга вернулось в бюджет компании.
export const OscarWithdrawResultDto = z.object({
  id: Uuid,
  refunded: z.number().int(),
});
export type OscarWithdrawResultDto = z.infer<typeof OscarWithdrawResultDto>;

export const OscarAwardInput = z.object({}).strict().optional();
export type OscarAwardInput = z.infer<typeof OscarAwardInput>;
