import { z } from '@hono/zod-openapi';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { permanentContracts, personRatings, persons, ratingTransactions } from '../../db/schema';
import type { JobHandler } from '../types';

const ParamsSchema = z
  .object({
    withPermanent: z.number().int().nonnegative().default(5),
    default: z.number().int().nonnegative().default(1),
  })
  .strict();

type Params = z.infer<typeof ParamsSchema>;

export const generateVariableHandler: JobHandler<Params> = {
  key: 'generate_variable',
  name: 'Генерация переменного рейтинга',
  description:
    '+N для персонажей с активным постоянным контрактом, +M для остальных открытых персонажей.',
  defaultCron: '5 0,6,12,18 * * *',
  defaultTimezone: 'Asia/Yekaterinburg',
  defaultParams: { withPermanent: 5, default: 1 },
  paramsSchema: ParamsSchema,

  async run(ctx, params) {
    const { db } = ctx;
    return db.transaction(async (tx) => {
      const openPersons = await tx
        .select({ id: persons.id })
        .from(persons)
        .where(eq(persons.isOpen, true));

      let withPermanent = 0;
      let withoutPermanent = 0;

      for (const p of openPersons) {
        const hasPermanent = await tx
          .select({ id: permanentContracts.id })
          .from(permanentContracts)
          .where(
            and(
              eq(permanentContracts.personId, p.id),
              eq(permanentContracts.statusCode, 'confirmed'),
              isNull(permanentContracts.endedAt),
            ),
          )
          .limit(1);

        const delta = hasPermanent.length > 0 ? params.withPermanent : params.default;
        if (delta === 0) continue;

        await tx
          .insert(personRatings)
          .values({ personId: p.id, generated: delta })
          .onConflictDoUpdate({
            target: personRatings.personId,
            set: {
              generated: sql`${personRatings.generated} + ${delta}`,
              updatedAt: sql`now()`,
            },
          });

        // Журнал рейтинга обязан содержать и автоматические начисления.
        await tx.insert(ratingTransactions).values({
          recipientPersonId: p.id,
          amount: delta,
          kind: 'generated',
          comment: 'Автоначисление переменного рейтинга',
        });

        if (hasPermanent.length > 0) withPermanent += 1;
        else withoutPermanent += 1;
      }

      return { withPermanent, withoutPermanent, total: openPersons.length };
    });
  },
};
