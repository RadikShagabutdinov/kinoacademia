import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';

export const JOB_KEYS = [
  'generate_variable',
  'reset_variable',
  'capitalize_companies',
  'cleanup_sessions',
] as const;
export const JobKey = z.enum(JOB_KEYS);
export type JobKey = z.infer<typeof JobKey>;

export const JOB_STATUSES = ['running', 'success', 'failed', 'skipped_idempotent'] as const;
export const JobStatus = z.enum(JOB_STATUSES);
export type JobStatus = z.infer<typeof JobStatus>;

export const CronExpr = z
  .string()
  .min(9)
  .max(120)
  .regex(/^[0-9*/,\-? a-zA-Z]+$/, 'Invalid characters in cron expression');
export type CronExpr = z.infer<typeof CronExpr>;

export const Timezone = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z_+\-/0-9]+$/, 'Invalid timezone format');
export type Timezone = z.infer<typeof Timezone>;

export const JobParams = z.record(z.string(), z.unknown());
export type JobParams = z.infer<typeof JobParams>;

export const JobDefinitionDto = z.object({
  id: Uuid,
  key: JobKey,
  name: z.string(),
  description: z.string().nullable(),
  cronExpr: CronExpr,
  timezone: Timezone,
  enabled: z.boolean(),
  params: JobParams,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type JobDefinitionDto = z.infer<typeof JobDefinitionDto>;

export const JobRunDto = z.object({
  id: Uuid,
  jobKey: JobKey,
  slot: z.string(),
  status: JobStatus,
  triggeredBy: z.string(),
  startedAt: IsoDateTime,
  finishedAt: IsoDateTime.nullable(),
  durationMs: z.number().int().nullable(),
  error: z.string().nullable(),
  output: z.unknown().nullable(),
});
export type JobRunDto = z.infer<typeof JobRunDto>;

export const JobDefinitionWithLastRunDto = JobDefinitionDto.extend({
  lastRun: JobRunDto.nullable(),
});
export type JobDefinitionWithLastRunDto = z.infer<typeof JobDefinitionWithLastRunDto>;

export const UpdateJobInput = z
  .object({
    cronExpr: CronExpr.optional(),
    timezone: Timezone.optional(),
    enabled: z.boolean().optional(),
    params: JobParams.optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateJobInput = z.infer<typeof UpdateJobInput>;

export const JobRunListQuery = z
  .object({
    limit: z.coerce.number().int().positive().max(200).optional(),
    status: JobStatus.optional(),
  })
  .strict();
export type JobRunListQuery = z.infer<typeof JobRunListQuery>;
