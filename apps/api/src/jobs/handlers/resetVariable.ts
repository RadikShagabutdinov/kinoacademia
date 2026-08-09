import { z } from '@hono/zod-openapi';
import { ne, sql } from 'drizzle-orm';
import { personRatings, ratingTransactions } from '../../db/schema';
import type { JobHandler } from '../types';

const ParamsSchema = z.object({}).strict();
type Params = z.infer<typeof ParamsSchema>;

export const resetVariableHandler: JobHandler<Params> = {
  key: 'reset_variable',
  name: 'Обнуление переменного рейтинга',
  description: 'Сбрасывает остаток generated в 0 у всех персонажей.',
  defaultCron: '0 18 * * *',
  defaultTimezone: 'Asia/Yekaterinburg',
  defaultParams: {},
  paramsSchema: ParamsSchema,

  async run(ctx) {
    const { db } = ctx;
    return db.transaction(async (tx) => {
      // Списанный остаток фиксируем в журнале: по ТЗ там должны быть все
      // изменения рейтинга, включая автоматические.
      const burned = await tx
        .select({ personId: personRatings.personId, generated: personRatings.generated })
        .from(personRatings)
        .where(ne(personRatings.generated, 0));

      if (burned.length === 0) return { reset: 0 };

      await tx
        .update(personRatings)
        .set({ generated: 0, updatedAt: sql`now()` })
        .where(ne(personRatings.generated, 0));

      await tx.insert(ratingTransactions).values(
        burned.map((r) => ({
          donorPersonId: r.personId,
          amount: r.generated,
          kind: 'generated' as const,
          comment: 'Обнуление остатка переменного рейтинга',
        })),
      );

      return { reset: burned.length };
    });
  },
};
