import type { z } from '@hono/zod-openapi';
import type { JobKey } from '@kinoacademia/shared';
import type { Database } from '../db/client';
import type { Logger } from '../logger';

export type JobRunContext = {
  db: Database;
  logger: Logger;
  triggeredBy: string;
  slot: string;
};

export type JobHandler<TParams = unknown> = {
  key: JobKey;
  name: string;
  description: string;
  defaultCron: string;
  defaultTimezone: string;
  defaultParams: TParams;
  paramsSchema: z.ZodType<TParams>;
  run: (ctx: JobRunContext, params: TParams) => Promise<unknown>;
};
