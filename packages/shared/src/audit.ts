import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';

export const AUDIT_ACTIONS = [
  'user.create',
  'user.update',
  'user.reset_password',
  'person.create',
  'person.update',
  'person.open',
  'person.close',
  'company.create',
  'company.update',
  'company.payment',
  'transaction.manual',
  'randomizer.apply',
  'randomizer.cancel',
  'job.update',
  'job.run_now',
  'film.create',
  'film.assignment.create',
  'film.assignment.delete',
  'oscar.nominate',
  'oscar.withdraw',
  'oscar.award',
  'scan.upload',
  'scan.delete',
] as const;
export const AuditAction = z.enum(AUDIT_ACTIONS);
export type AuditAction = z.infer<typeof AuditAction>;

export const AUDIT_ENTITY_TYPES = [
  'user',
  'person',
  'company',
  'rating',
  'job',
  'randomizer',
  'film',
  'oscar',
  'scan_set',
] as const;
export const AuditEntityType = z.enum(AUDIT_ENTITY_TYPES);
export type AuditEntityType = z.infer<typeof AuditEntityType>;

export const AuditLogEntryDto = z.object({
  id: Uuid,
  actorUserId: Uuid.nullable(),
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: Uuid.nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  createdAt: IsoDateTime,
});
export type AuditLogEntryDto = z.infer<typeof AuditLogEntryDto>;

export const AuditLogQuery = z
  .object({
    entityType: AuditEntityType.optional(),
    entityId: Uuid.optional(),
    actorUserId: Uuid.optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict();
export type AuditLogQuery = z.infer<typeof AuditLogQuery>;
