import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';
import { RaceCode } from './races';
import { RoleCode } from './roles';

export const PersonDto = z.object({
  id: Uuid,
  userId: Uuid.nullable(),
  displayName: z.string().min(1).max(120),
  roleCode: RoleCode,
  age: z.number().int().min(0).max(10_000).nullable(),
  isOpen: z.boolean(),
  isStar: z.boolean().optional(),
  closedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type PersonDto = z.infer<typeof PersonDto>;

/** Раса — скрытая игровая информация, поэтому она есть только в админских ответах. */
export const AdminPersonDto = PersonDto.extend({
  raceCode: RaceCode,
});
export type AdminPersonDto = z.infer<typeof AdminPersonDto>;

export const PersonDossierDto = AdminPersonDto.extend({
  user: z
    .object({
      id: Uuid,
      login: z.string().min(3).max(64),
      roleCode: RoleCode,
      isActive: z.boolean(),
    })
    .nullable(),
});
export type PersonDossierDto = z.infer<typeof PersonDossierDto>;

export const CreatePersonInput = z.object({
  userId: Uuid.nullable().optional(),
  displayName: z.string().min(1).max(120),
  raceCode: RaceCode,
  roleCode: RoleCode,
  age: z.number().int().min(0).max(10_000).nullable().optional(),
});
export type CreatePersonInput = z.infer<typeof CreatePersonInput>;

export const UpdatePersonInput = CreatePersonInput.partial().extend({
  isOpen: z.boolean().optional(),
});
export type UpdatePersonInput = z.infer<typeof UpdatePersonInput>;
