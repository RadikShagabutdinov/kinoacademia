import { z } from '@hono/zod-openapi';
import { CAPITALIZATION_PER_EMPLOYEE_CAP } from '@kinoacademia/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { permanentContracts, personRatings } from '../../db/schema';
import { applyCapitalization } from '../../modules/ratings/ratings.service';
import type { JobHandler } from '../types';

const ParamsSchema = z.object({}).strict();
type Params = z.infer<typeof ParamsSchema>;

export const capitalizeCompaniesHandler: JobHandler<Params> = {
  key: 'capitalize_companies',
  name: 'Капитализация рейтинга компаний',
  description: `Накопительное начисление: постоянному рейтингу компании прибавляется постоянный рейтинг каждого сотрудника на постоянном контракте, но не более ${CAPITALIZATION_PER_EMPLOYEE_CAP} пунктов за сотрудника.`,
  defaultCron: '55 5,17 * * *',
  defaultTimezone: 'Asia/Yekaterinburg',
  defaultParams: {},
  paramsSchema: ParamsSchema,

  async run(ctx) {
    const { db } = ctx;
    const rows = await db
      .select({
        companyId: permanentContracts.companyId,
        amount: sql<number>`SUM(LEAST(${personRatings.nowPermanent}, ${CAPITALIZATION_PER_EMPLOYEE_CAP}))`,
      })
      .from(permanentContracts)
      .innerJoin(personRatings, eq(personRatings.personId, permanentContracts.personId))
      .where(
        and(eq(permanentContracts.statusCode, 'confirmed'), isNull(permanentContracts.endedAt)),
      )
      .groupBy(permanentContracts.companyId);

    const entries = rows.map((r) => ({ companyId: r.companyId, amount: Number(r.amount) }));
    const credited = await applyCapitalization(entries);

    return { companies: entries.length, credited };
  },
};
