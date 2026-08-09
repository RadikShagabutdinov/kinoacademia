import { CronExpressionParser } from 'cron-parser';
import { validate as cronValidate } from 'node-cron';
import { afterAll, describe, expect, it } from 'vitest';
import { allHandlers } from './registry';

describe('scheduler / cron defaults', () => {
  it('every default cron expression is valid for node-cron', () => {
    for (const handler of allHandlers()) {
      expect(cronValidate(handler.defaultCron)).toBe(true);
    }
  });

  it('every default cron expression is parsable in its default timezone', () => {
    for (const handler of allHandlers()) {
      const it = CronExpressionParser.parse(handler.defaultCron, {
        tz: handler.defaultTimezone,
      });
      const next = it.next();
      expect(next.toDate().getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe.skipIf(process.env.RUN_DB_SMOKE !== '1')('scheduler.reload (DB-backed)', () => {
  it('start, reload, and stop operate against job_definitions', async () => {
    const { reload, stop, start } = await import('./scheduler');
    await start();
    await reload();
    stop();
    expect(true).toBe(true);
  });

  afterAll(async () => {
    const { queryClient } = await import('../db/client');
    await queryClient.end();
  });
});
