import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, queryClient } from './client';

describe.skipIf(process.env.RUN_DB_SMOKE !== '1')('db smoke', () => {
  afterAll(async () => {
    await queryClient.end();
  });

  it('connects and runs select 1', async () => {
    const rows = await db.execute(sql`select 1 as value`);
    expect(rows[0]).toEqual({ value: 1 });
  });
});
