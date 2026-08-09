import { z } from '@hono/zod-openapi';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  companies,
  companyRatings,
  permanentContracts,
  personRatings,
  ratingTransactions,
} from '../../db/schema';
import type { JobHandler } from '../types';

const ParamsSchema = z.object({}).strict();
type Params = z.infer<typeof ParamsSchema>;

const calcPersonNowPermanent = sql<number>`
  ${personRatings.base}
  + ${personRatings.randomizer}
  + ${personRatings.systemTopup}
  + ${personRatings.manualTopup}
  + ${personRatings.oscar}
  - ${personRatings.penalties}
`;

export const capitalizeCompaniesHandler: JobHandler<Params> = {
  key: 'capitalize_companies',
  name: 'Капитализация рейтинга компаний',
  description:
    'Пересчёт employee_permanent: сумма nowPermanent всех сотрудников с активным постоянным контрактом.',
  defaultCron: '0 */12 * * *',
  defaultTimezone: 'Asia/Yekaterinburg',
  defaultParams: {},
  paramsSchema: ParamsSchema,

  async run(ctx) {
    const { db } = ctx;
    return db.transaction(async (tx) => {
      const allCompanies = await tx.select({ id: companies.id }).from(companies);
      let updated = 0;

      for (const c of allCompanies) {
        const sumRows = await tx
          .select({
            sum: sql<number>`COALESCE(SUM(${calcPersonNowPermanent}), 0)`,
          })
          .from(permanentContracts)
          .innerJoin(personRatings, eq(personRatings.personId, permanentContracts.personId))
          .where(
            and(
              eq(permanentContracts.companyId, c.id),
              eq(permanentContracts.statusCode, 'confirmed'),
              isNull(permanentContracts.endedAt),
            ),
          );

        const employeePermanent = Number(sumRows[0]?.sum ?? 0);

        const previousRows = await tx
          .select({ employeePermanent: companyRatings.employeePermanent })
          .from(companyRatings)
          .where(eq(companyRatings.companyId, c.id))
          .limit(1);
        const previous = previousRows[0]?.employeePermanent ?? 0;

        await tx
          .insert(companyRatings)
          .values({ companyId: c.id, employeePermanent })
          .onConflictDoUpdate({
            target: companyRatings.companyId,
            set: { employeePermanent, updatedAt: sql`now()` },
          });

        // В журнал попадает только фактическое изменение капитализации.
        if (employeePermanent !== previous) {
          await tx.insert(ratingTransactions).values({
            recipientCompanyId: c.id,
            amount: employeePermanent - previous,
            kind: 'generated',
            comment: 'Капитализация сотрудников',
          });
        }
        updated += 1;
      }

      return { companies: allCompanies.length, updated };
    });
  },
};
