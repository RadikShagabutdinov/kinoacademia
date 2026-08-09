import { createRoute, z } from '@hono/zod-openapi';
import { type ApiError, CompanyDto, Uuid } from '@kinoacademia/shared';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import {
  findCompanyByHeadUserId,
  findCompanyById,
  toCompanyDto,
} from '../modules/companies/companies-repo';
import { createOpenAPIApp } from '../openapi/app';
import { errorResponses } from '../openapi/responses';

type Env = { Variables: AuthVariables };

const CompanyIdParam = z.object({
  id: Uuid,
});

const getMyCompanyRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'get',
  path: '/my',
  tags: ['companies'],
  summary: 'Get my company',
  description:
    'Retrieve company for currently authenticated head user. Requires head or admin role.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Company data',
      content: {
        'application/json': {
          schema: CompanyDto.openapi('CompanyDto'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const getCompanyByIdRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['companies'],
  summary: 'Get company by ID',
  description:
    'Retrieve company by ID. Head users can only access their own company, admin and info roles can access any company.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
  },
  responses: {
    200: {
      description: 'Company data',
      content: {
        'application/json': {
          schema: CompanyDto.openapi('CompanyDto'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const companiesRoutes = createOpenAPIApp<Env>();

companiesRoutes.use('*', requireAuth);

companiesRoutes.openapi(getMyCompanyRoute, async (c) => {
  const user = c.get('user');
  const company = await findCompanyByHeadUserId(user.id);
  if (!company) {
    return c.json({ code: 'not_found', message: 'No company assigned' } satisfies ApiError, 404);
  }
  return c.json(toCompanyDto(company), 200);
});

companiesRoutes.openapi(getCompanyByIdRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');
  const company = await findCompanyById(id);
  if (!company) {
    return c.json({ code: 'not_found', message: 'Company not found' } satisfies ApiError, 404);
  }
  if (user.role === 'head') {
    const owns = await ownsCompany(db, user.id, id);
    if (!owns) {
      return c.json({ code: 'forbidden', message: 'Not your company' } satisfies ApiError, 403);
    }
  }
  return c.json(toCompanyDto(company), 200);
});
