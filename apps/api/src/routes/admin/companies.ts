import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  BranchCode,
  CompanyDto,
  CreateCompanyInput,
  UpdateCompanyInput,
  Uuid,
} from '@kinoacademia/shared';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import {
  createCompany,
  findCompanyById,
  listCompanies,
  toCompanyDto,
  updateCompany,
} from '../../modules/companies/companies-repo';
import { findPersonById } from '../../modules/persons/persons-repo';
import { findUserById } from '../../modules/users/users-repo';
import { createOpenAPIApp } from '../../openapi/app';
import { apiError, errorResponses } from '../../openapi/responses';

const ListCompaniesQuery = z.object({
  branchCode: BranchCode.optional(),
});

const CompanyIdParam = z.object({
  id: Uuid,
});

const listCompaniesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List companies',
  description: 'List all companies with optional filter by branchCode. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    query: ListCompaniesQuery,
  },
  responses: {
    200: {
      description: 'List of companies',
      content: {
        'application/json': {
          schema: z.array(CompanyDto).openapi('CompanyList'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getCompanyRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['admin'],
  summary: 'Get company',
  description: 'Retrieve company by ID. Admin role required.',
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

const createCompanyRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Create company',
  description:
    'Create a new company. If headPersonId provided, validates that person exists. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateCompanyInput.openapi('CreateCompanyInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Company created successfully',
      content: {
        'application/json': {
          schema: CompanyDto.openapi('CompanyDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const updateCompanyRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['admin'],
  summary: 'Update company',
  description:
    'Update company fields. If headPersonId provided, validates that person exists. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateCompanyInput.openapi('UpdateCompanyInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Company updated successfully',
      content: {
        'application/json': {
          schema: CompanyDto.openapi('CompanyDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const adminCompaniesRoutes = createOpenAPIApp();

adminCompaniesRoutes.use('*', requireAuth, requireRole('admin'));

adminCompaniesRoutes.openapi(listCompaniesRoute, async (c) => {
  const { branchCode } = c.req.valid('query');
  const rows = await listCompanies({
    ...(branchCode !== undefined && { branchCode }),
  });
  return c.json(rows.map(toCompanyDto), 200);
});

adminCompaniesRoutes.openapi(getCompanyRoute, async (c) => {
  const { id } = c.req.valid('param');
  const company = await findCompanyById(id);
  if (!company) {
    return c.json({ code: 'not_found', message: 'Company not found' } satisfies ApiError, 404);
  }
  return c.json(toCompanyDto(company), 200);
});

/**
 * Руководителем компании может быть только персонаж, у чьего аккаунта роль
 * `head`: роль на пользователе и глава на компании — независимые поля, и без
 * этой проверки назначенный глава не получит доступ к контрактам компании.
 */
const checkHeadPerson = async (
  headPersonId: string,
): Promise<{ status: 400 | 404; body: ApiError } | null> => {
  const person = await findPersonById(headPersonId);
  if (!person) {
    return { status: 404, body: { code: 'not_found', message: 'Head person not found' } };
  }
  const user = person.userId ? await findUserById(person.userId) : null;
  if (!user || user.roleCode !== 'head') {
    return {
      status: 400,
      body: {
        code: 'validation_error',
        message: 'Head person must be linked to a user with the "head" role',
      },
    };
  }
  return null;
};

adminCompaniesRoutes.openapi(createCompanyRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const data = c.req.valid('json');

  if (data.headPersonId) {
    const problem = await checkHeadPerson(data.headPersonId);
    if (problem) {
      return problem.status === 404
        ? apiError(c, 404, problem.body)
        : apiError(c, 400, problem.body);
    }
  }

  const company = await createCompany({
    name: data.name,
    branchCode: data.branchCode,
    ...(data.headPersonId !== undefined && { headPersonId: data.headPersonId }),
  });
  await writeAudit({
    actorUserId: actor.id,
    action: 'company.create',
    entityType: 'company',
    entityId: company.id,
    payload: {
      name: data.name,
      branchCode: data.branchCode,
      headPersonId: data.headPersonId ?? null,
    },
  });
  return c.json(toCompanyDto(company), 201);
});

adminCompaniesRoutes.openapi(updateCompanyRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');

  if (Object.keys(data).length === 0) {
    return apiError(c, 400, { code: 'validation_error', message: 'No fields to update' });
  }

  const existing = await findCompanyById(id);
  if (!existing) {
    return c.json({ code: 'not_found', message: 'Company not found' } satisfies ApiError, 404);
  }

  // Системная компания — контейнер типовых сканов: у неё не может быть главы,
  // иначе она попадёт в /companies/my и станет играбельной (контракты, сканы).
  if (existing.isSystem && data.headPersonId) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'System company cannot have a head person',
    });
  }

  if (data.headPersonId) {
    const problem = await checkHeadPerson(data.headPersonId);
    if (problem) {
      return problem.status === 404
        ? apiError(c, 404, problem.body)
        : apiError(c, 400, problem.body);
    }
  }

  const updated = await updateCompany(id, {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.branchCode !== undefined && { branchCode: data.branchCode }),
    ...(data.headPersonId !== undefined && { headPersonId: data.headPersonId }),
  });
  if (!updated) {
    return c.json({ code: 'not_found', message: 'Company not found' } satisfies ApiError, 404);
  }
  await writeAudit({
    actorUserId: actor.id,
    action: 'company.update',
    entityType: 'company',
    entityId: id,
    payload: data,
  });
  return c.json(toCompanyDto(updated), 200);
});
