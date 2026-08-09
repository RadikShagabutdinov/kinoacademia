import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  JobDefinitionDto,
  JobDefinitionWithLastRunDto,
  JobKey,
  JobRunDto,
  JobRunListQuery,
  UpdateJobInput,
} from '@kinoacademia/shared';
import { CronExpressionParser } from 'cron-parser';
import { and, desc, eq, ne } from 'drizzle-orm';
import { validate as cronValidate } from 'node-cron';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
type AdminUser = AuthVariables['user'];
import { db } from '../../db/client';
import { type JobDefinitionRow, type JobRunRow, jobDefinitions, jobRuns } from '../../db/schema';
import { requireHandler } from '../../jobs/registry';
import { reload as reloadScheduler, runNow } from '../../jobs/scheduler';
import { writeAudit } from '../../modules/audit/audit-repo';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';

export const adminJobsRoutes = createOpenAPIApp();
adminJobsRoutes.use('*', requireAuth, requireRole('admin'));

const SUPPORTED_TIMEZONES = (() => {
  try {
    const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    return new Set(intlAny.supportedValuesOf?.('timeZone') ?? []);
  } catch {
    return new Set<string>();
  }
})();

const isKnownTimezone = (tz: string): boolean => {
  if (SUPPORTED_TIMEZONES.size > 0) return SUPPORTED_TIMEZONES.has(tz);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const toJobDefinitionDto = (row: JobDefinitionRow) =>
  JobDefinitionDto.parse({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    cronExpr: row.cronExpr,
    timezone: row.timezone,
    enabled: row.enabled,
    params: (row.params ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

const toJobRunDto = (row: JobRunRow) => {
  const finishedAt = row.finishedAt ? row.finishedAt.toISOString() : null;
  const startedAt = row.startedAt.toISOString();
  const durationMs = row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : null;
  return JobRunDto.parse({
    id: row.id,
    jobKey: row.jobKey,
    slot: row.slot,
    status: row.status,
    triggeredBy: row.triggeredBy,
    startedAt,
    finishedAt,
    durationMs,
    error: row.error,
    output: row.output ?? null,
  });
};

const findDefinition = async (key: string): Promise<JobDefinitionRow | null> => {
  const rows = await db.select().from(jobDefinitions).where(eq(jobDefinitions.key, key)).limit(1);
  return rows[0] ?? null;
};

const lastRunFor = async (key: string): Promise<JobRunRow | null> => {
  const rows = await db
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.jobKey, key), ne(jobRuns.status, 'skipped_idempotent')))
    .orderBy(desc(jobRuns.startedAt))
    .limit(1);
  return rows[0] ?? null;
};

const apiError = (code: ApiError['code'], message: string, details?: unknown): ApiError => ({
  code,
  message,
  details,
});

const listJobsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List job definitions',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of jobs with last run',
      content: {
        'application/json': {
          schema: z.array(JobDefinitionWithLastRunDto).openapi('JobDefinitionWithLastRunList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getJobRoute = createRoute({
  method: 'get',
  path: '/{key}',
  tags: ['admin'],
  summary: 'Get job definition',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ key: JobKey }),
  },
  responses: {
    200: {
      description: 'Job definition with last run',
      content: {
        'application/json': {
          schema: JobDefinitionWithLastRunDto.openapi('JobDefinitionWithLastRun'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const updateJobRoute = createRoute({
  method: 'patch',
  path: '/{key}',
  tags: ['admin'],
  summary: 'Update job definition',
  description:
    'Update cron expression, timezone, enabled flag or params. After successful update, scheduler is reloaded without restart.',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ key: JobKey }),
    body: {
      content: {
        'application/json': {
          schema: UpdateJobInput.openapi('UpdateJobInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated job definition',
      content: {
        'application/json': {
          schema: JobDefinitionDto.openapi('JobDefinition'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const runNowRoute = createRoute({
  method: 'post',
  path: '/{key}/run',
  tags: ['admin'],
  summary: 'Trigger manual job run',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ key: JobKey }),
  },
  responses: {
    200: {
      description: 'Job triggered',
      content: {
        'application/json': {
          schema: z.object({ slot: z.string() }).openapi('JobRunNowResult'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const runsHistoryRoute = createRoute({
  method: 'get',
  path: '/{key}/runs',
  tags: ['admin'],
  summary: 'List job runs history',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ key: JobKey }),
    query: JobRunListQuery,
  },
  responses: {
    200: {
      description: 'Job runs',
      content: {
        'application/json': {
          schema: z.array(JobRunDto).openapi('JobRunList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

adminJobsRoutes.openapi(listJobsRoute, async (c) => {
  const rows = await db.select().from(jobDefinitions).orderBy(jobDefinitions.key);
  const result = await Promise.all(
    rows.map(async (row) => {
      const last = await lastRunFor(row.key);
      return {
        ...toJobDefinitionDto(row),
        lastRun: last ? toJobRunDto(last) : null,
      };
    }),
  );
  return c.json(result, 200);
});

adminJobsRoutes.openapi(getJobRoute, async (c) => {
  const { key } = c.req.valid('param');
  const row = await findDefinition(key);
  if (!row) return c.json(apiError('not_found', `Job not found: ${key}`), 404);
  const last = await lastRunFor(key);
  return c.json(
    {
      ...toJobDefinitionDto(row),
      lastRun: last ? toJobRunDto(last) : null,
    },
    200,
  );
});

adminJobsRoutes.openapi(updateJobRoute, async (c) => {
  const actor = c.get('user') as AdminUser;
  const { key } = c.req.valid('param');
  const input = c.req.valid('json');

  const row = await findDefinition(key);
  if (!row) return c.json(apiError('not_found', `Job not found: ${key}`), 404);

  const handler = requireHandler(key);

  const cronExpr = input.cronExpr ?? row.cronExpr;
  const timezone = input.timezone ?? row.timezone;

  if (input.cronExpr !== undefined && !cronValidate(cronExpr)) {
    return c.json(apiError('validation_error', `Invalid cron expression: ${cronExpr}`), 400);
  }
  if (input.timezone !== undefined && !isKnownTimezone(timezone)) {
    return c.json(apiError('validation_error', `Unknown timezone: ${timezone}`), 400);
  }

  if (input.cronExpr !== undefined || input.timezone !== undefined) {
    try {
      CronExpressionParser.parse(cronExpr, { tz: timezone });
    } catch (err) {
      return c.json(
        apiError('validation_error', err instanceof Error ? err.message : 'Invalid cron/timezone'),
        400,
      );
    }
  }

  if (input.params !== undefined) {
    const parsed = handler.paramsSchema.safeParse(input.params);
    if (!parsed.success) {
      return c.json(
        apiError('validation_error', 'Invalid params', {
          issues: parsed.error.issues,
        }),
        400,
      );
    }
  }

  const updatedRows = await db
    .update(jobDefinitions)
    .set({
      cronExpr,
      timezone,
      enabled: input.enabled ?? row.enabled,
      params: (input.params ?? (row.params as Record<string, unknown>)) as never,
      updatedAt: new Date(),
    })
    .where(eq(jobDefinitions.key, key))
    .returning();

  const updated = updatedRows[0];
  if (!updated) return c.json(apiError('not_found', `Job not found: ${key}`), 404);

  await reloadScheduler();

  await writeAudit({
    actorUserId: actor.id,
    action: 'job.update',
    entityType: 'job',
    entityId: updated.id,
    payload: { key, ...input },
  });

  return c.json(toJobDefinitionDto(updated), 200);
});

adminJobsRoutes.openapi(runNowRoute, async (c) => {
  const { key } = c.req.valid('param');
  const user = c.get('user') as AdminUser;
  const row = await findDefinition(key);
  if (!row) return c.json(apiError('not_found', `Job not found: ${key}`), 404);
  const result = await runNow(key, user.id);
  await writeAudit({
    actorUserId: user.id,
    action: 'job.run_now',
    entityType: 'job',
    entityId: row.id,
    payload: { key, slot: result.slot },
  });
  return c.json(result, 200);
});

adminJobsRoutes.openapi(runsHistoryRoute, async (c) => {
  const { key } = c.req.valid('param');
  const { limit = 50, status } = c.req.valid('query');

  const row = await findDefinition(key);
  if (!row) return c.json(apiError('not_found', `Job not found: ${key}`), 404);

  const where = status
    ? and(eq(jobRuns.jobKey, key), eq(jobRuns.status, status))
    : eq(jobRuns.jobKey, key);

  const rows = await db
    .select()
    .from(jobRuns)
    .where(where)
    .orderBy(desc(jobRuns.startedAt))
    .limit(limit);

  return c.json(rows.map(toJobRunDto), 200);
});
