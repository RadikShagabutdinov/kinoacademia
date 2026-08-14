import { z } from '@hono/zod-openapi';
import { CAPITALIZATION_PER_EMPLOYEE_CAP } from '@kinoacademia/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { permanentContracts, personRatings } from '../../db/schema';
import { applyCapitalization } from '../../modules/ratings/ratings.service';
import type { JobHandler } from '../types';

const ParamsSchema = z.object({}).strict();
type Params = z.infer<typeof ParamsSchema>;

/**
 * Вклад одного сотрудника в капитализацию за одно начисление и та его часть,
 * которую дал секретный модификатор: «сколько компания получила с модификатором
 * минус сколько получила бы без него» — уже с учётом потолка. Доля копится
 * отдельно, чтобы обнуление модификатора могло изъять её у компаний.
 */
export const employeeCapitalization = (
  nowPermanent: number,
  randomizer: number,
): { amount: number; randomizerShare: number } => {
  const amount = Math.min(nowPermanent, CAPITALIZATION_PER_EMPLOYEE_CAP);
  const withoutRandomizer = Math.min(nowPermanent - randomizer, CAPITALIZATION_PER_EMPLOYEE_CAP);
  return { amount, randomizerShare: amount - withoutRandomizer };
};

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
        nowPermanent: personRatings.nowPermanent,
        randomizer: personRatings.randomizer,
      })
      .from(permanentContracts)
      .innerJoin(personRatings, eq(personRatings.personId, permanentContracts.personId))
      .where(
        and(eq(permanentContracts.statusCode, 'confirmed'), isNull(permanentContracts.endedAt)),
      );

    const totals = new Map<string, { amount: number; randomizerShare: number }>();
    for (const row of rows) {
      const { amount, randomizerShare } = employeeCapitalization(row.nowPermanent, row.randomizer);
      const acc = totals.get(row.companyId) ?? { amount: 0, randomizerShare: 0 };
      acc.amount += amount;
      acc.randomizerShare += randomizerShare;
      totals.set(row.companyId, acc);
    }

    const entries = Array.from(totals, ([companyId, sums]) => ({ companyId, ...sums }));
    const credited = await applyCapitalization(entries);

    return { companies: entries.length, credited };
  },
};
