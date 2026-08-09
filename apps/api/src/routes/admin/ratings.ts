import { createRoute, z } from '@hono/zod-openapi';
import { CompanyRatingDto, PersonRatingAdminDto, Uuid } from '@kinoacademia/shared';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import * as ratings from '../../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';
import { CompanyNameEntry, PersonNameEntry, collectAllRatings } from '../ratings';

type AdminEnv = { Variables: AuthVariables };

export const adminRatingsRoutes = createOpenAPIApp<AdminEnv>();

adminRatingsRoutes.use('*', requireAuth, requireRole('admin'));

const AdminAllRatingsResponse = z.object({
  persons: z.array(PersonRatingAdminDto),
  companies: z.array(CompanyRatingDto),
  personNames: z.record(Uuid, PersonNameEntry),
  companyNames: z.record(Uuid, CompanyNameEntry),
});

const getAdminAllRatingsRoute = createRoute({
  method: 'get',
  path: '/all',
  tags: ['admin'],
  summary: 'Get all ratings with full breakdown',
  description:
    'Same payload as GET /ratings/all, but person ratings carry the full breakdown: raw base plus the secret master randomizer modifier (folded into base everywhere else). Admin role required.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'All ratings with admin-only breakdown',
      content: {
        'application/json': {
          schema: AdminAllRatingsResponse.openapi('AdminAllRatingsResponse'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

adminRatingsRoutes.openapi(getAdminAllRatingsRoute, async (c) => {
  const { personRatings, companies, personNames, companyNames } = await collectAllRatings();
  return c.json(
    {
      persons: personRatings.map(({ row, isStar }) => ratings.toPersonRatingAdminDto(row, isStar)),
      companies,
      personNames,
      companyNames,
    },
    200,
  );
});
