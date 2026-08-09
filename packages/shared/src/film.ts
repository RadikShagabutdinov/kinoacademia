import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';
import { ContractKind } from './contract';

export const FILM_ROLES = [
  'director',
  'actor_lead_male',
  'actress_lead_female',
  'actor_supporting',
  'screenwriter',
  'cinematographer',
  'visual_artist',
] as const;
export const FilmRole = z.enum(FILM_ROLES);
export type FilmRole = z.infer<typeof FilmRole>;

export const FilmDto = z.object({
  id: Uuid,
  companyId: Uuid,
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type FilmDto = z.infer<typeof FilmDto>;

export const CreateFilmInput = z.object({
  companyId: Uuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export type CreateFilmInput = z.infer<typeof CreateFilmInput>;

export const FilmAssignmentDto = z.object({
  id: Uuid,
  filmId: Uuid,
  personId: Uuid,
  role: FilmRole,
  contractId: Uuid.nullable(),
  contractKind: ContractKind.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type FilmAssignmentDto = z.infer<typeof FilmAssignmentDto>;

export const CreateFilmAssignmentInput = z.object({
  filmId: Uuid,
  personId: Uuid,
  role: FilmRole,
  contractId: Uuid.optional(),
  contractKind: ContractKind.optional(),
});
export type CreateFilmAssignmentInput = z.infer<typeof CreateFilmAssignmentInput>;

export const FilmAssignmentDetailDto = FilmAssignmentDto.extend({
  personName: z.string(),
});
export type FilmAssignmentDetailDto = z.infer<typeof FilmAssignmentDetailDto>;

export const FilmWithAssignmentsDto = FilmDto.extend({
  companyName: z.string(),
  assignments: z.array(FilmAssignmentDetailDto),
});
export type FilmWithAssignmentsDto = z.infer<typeof FilmWithAssignmentsDto>;

export const FILM_ROLE_LABELS: Record<FilmRole, string> = {
  director: 'Режиссёр',
  actor_lead_male: 'Актёр 1-го плана',
  actress_lead_female: 'Актриса 1-го плана',
  actor_supporting: 'Актёр 2-го плана',
  screenwriter: 'Сценарист',
  cinematographer: 'Оператор',
  visual_artist: 'Художник по визуалу',
};
