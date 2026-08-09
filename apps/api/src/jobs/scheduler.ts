import type { JobKey, JobStatus } from '@kinoacademia/shared';
import { CronExpressionParser } from 'cron-parser';
import { eq, sql } from 'drizzle-orm';
import { type ScheduledTask, schedule, validate } from 'node-cron';
import { db } from '../db/client';
import { type JobDefinitionRow, jobDefinitions, jobRuns } from '../db/schema';
import { logger } from '../logger';
import * as hub from '../ws/hub';
import { requireHandler } from './registry';
import { cronSlot, manualSlot } from './slot';
import type { JobHandler, JobRunContext } from './types';

const log = logger.child({ module: 'jobs' });

let tasks: Map<JobKey, ScheduledTask> = new Map();
let started = false;

const recordRun = async (input: {
  jobKey: JobKey;
  slot: string;
  triggeredBy: string;
}): Promise<{ id: string } | null> => {
  const inserted = await db
    .insert(jobRuns)
    .values({
      jobKey: input.jobKey,
      slot: input.slot,
      status: 'running' satisfies JobStatus,
      triggeredBy: input.triggeredBy,
    })
    .onConflictDoNothing({ target: [jobRuns.jobKey, jobRuns.slot] })
    .returning({ id: jobRuns.id });
  return inserted[0] ?? null;
};

const finishRun = async (
  id: string,
  status: Exclude<JobStatus, 'running'>,
  patch: { error?: string; output?: unknown } = {},
): Promise<void> => {
  await db
    .update(jobRuns)
    .set({
      status,
      finishedAt: sql`now()`,
      error: patch.error ?? null,
      output: (patch.output ?? null) as never,
    })
    .where(eq(jobRuns.id, id));
};

const recordSkip = async (input: {
  jobKey: JobKey;
  slot: string;
  triggeredBy: string;
}): Promise<void> => {
  await db.insert(jobRuns).values({
    jobKey: input.jobKey,
    slot: `${input.slot}#skipped:${Date.now()}`,
    status: 'skipped_idempotent' satisfies JobStatus,
    triggeredBy: input.triggeredBy,
    finishedAt: sql`now()`,
  });
};

export const executeJob = async (input: {
  definition: JobDefinitionRow;
  triggeredBy: string;
  slot: string;
}): Promise<void> => {
  const { definition, triggeredBy, slot } = input;
  const jobKey = definition.key as JobKey;
  const handler = requireHandler(jobKey);
  const params = handler.paramsSchema.parse(definition.params ?? handler.defaultParams);

  const inserted = await recordRun({ jobKey, slot, triggeredBy });
  if (!inserted) {
    log.warn({ jobKey, slot }, 'job run skipped (idempotent)');
    await recordSkip({ jobKey, slot, triggeredBy });
    hub.broadcast('system', 'job.finished', {
      jobKey,
      slot,
      status: 'skipped_idempotent',
      triggeredBy,
    });
    return;
  }

  const startedAt = Date.now();
  log.info({ jobKey, slot, triggeredBy }, 'job run started');

  const ctx: JobRunContext = { db, logger: log, triggeredBy, slot };

  const broadcastJob = (
    status: 'success' | 'failed' | 'skipped_idempotent',
    patch: { error?: string; output?: unknown } = {},
  ) => {
    hub.broadcast('system', 'job.finished', {
      jobKey,
      slot,
      status,
      triggeredBy,
      durationMs: Date.now() - startedAt,
      ...(patch.error !== undefined && { error: patch.error }),
      ...(patch.output !== undefined && { output: patch.output }),
    });
  };

  try {
    const output = await handler.run(ctx, params);
    await finishRun(inserted.id, 'success', { output });
    log.info({ jobKey, slot, durationMs: Date.now() - startedAt }, 'job run finished');
    broadcastJob('success', { output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(inserted.id, 'failed', { error: message });
    log.error({ jobKey, slot, err: message }, 'job run failed');
    broadcastJob('failed', { error: message });
  }
};

const validateCronExpr = (expr: string, timezone: string): void => {
  if (!validate(expr)) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }
  CronExpressionParser.parse(expr, { tz: timezone });
};

const registerTask = (definition: JobDefinitionRow): void => {
  if (!definition.enabled) return;
  const jobKey = definition.key as JobKey;

  try {
    validateCronExpr(definition.cronExpr, definition.timezone);
  } catch (err) {
    log.error(
      { jobKey, err: err instanceof Error ? err.message : err },
      'invalid cron expression, skipping registration',
    );
    return;
  }

  const task = schedule(
    definition.cronExpr,
    async () => {
      const slot = cronSlot(new Date());
      try {
        await executeJob({ definition, triggeredBy: 'cron', slot });
      } catch (err) {
        log.error({ jobKey, err }, 'unhandled job error');
      }
    },
    { timezone: definition.timezone },
  );

  tasks.set(jobKey, task);
  log.info({ jobKey, cron: definition.cronExpr, timezone: definition.timezone }, 'job scheduled');
};

const stopAll = (): void => {
  for (const task of tasks.values()) {
    task.stop();
  }
  tasks = new Map();
};

export const start = async (): Promise<void> => {
  if (started) return;
  started = true;
  await reload();
};

export const reload = async (): Promise<void> => {
  stopAll();
  const rows = await db.select().from(jobDefinitions);
  for (const row of rows) {
    registerTask(row);
  }
  log.info({ count: tasks.size }, 'job scheduler reloaded');
};

export const stop = (): void => {
  stopAll();
  started = false;
};

export const runNow = async (
  jobKey: JobKey,
  triggeredByUserId: string,
): Promise<{ slot: string }> => {
  const rows = await db
    .select()
    .from(jobDefinitions)
    .where(eq(jobDefinitions.key, jobKey))
    .limit(1);
  const definition = rows[0];
  if (!definition) throw new Error(`Job definition not found: ${jobKey}`);

  const slot = manualSlot();
  await executeJob({ definition, triggeredBy: `manual:${triggeredByUserId}`, slot });
  return { slot };
};

export const isStarted = (): boolean => started;

export const _internal = {
  getTasks: () => tasks,
  registerTask,
  stopAll,
};

export type SchedulerHandlerSummary = {
  key: JobKey;
  handler: JobHandler<unknown>;
};
