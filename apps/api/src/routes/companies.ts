import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  CompanyDto,
  CompanyPaymentInput,
  CompanyRatingDto,
  PersonRatingDto,
  RatingTransactionDto,
  Uuid,
} from '@kinoacademia/shared';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import { writeAudit } from '../modules/audit/audit-repo';
import {
  findCompanyByHeadUserId,
  findCompanyById,
  listCompanies,
  toCompanyDto,
} from '../modules/companies/companies-repo';
import { findPersonById } from '../modules/persons/persons-repo';
import * as ratings from '../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';
import { handleRatingError } from './rating-error';

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

const listCompaniesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['companies'],
  summary: 'List companies',
  description:
    'List playable companies (system scan containers are excluded). Available to any authenticated user: heads pick a payment recipient from this list.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of companies',
      content: {
        'application/json': {
          schema: z.array(CompanyDto),
        },
      },
    },
    401: errorResponses[401],
  },
});

const CompanyPaymentResponse = z.object({
  company: CompanyRatingDto,
  recipient: z.union([PersonRatingDto, CompanyRatingDto]),
  transaction: RatingTransactionDto,
});

const createCompanyPaymentRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/:id/payments',
  tags: ['companies'],
  summary: 'Pay from company budget',
  description:
    'Spend company budget: credits the recipient (person or another company) permanent rating and debits the same amount from the budget. Heads can only spend their own company budget.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
    body: {
      content: {
        'application/json': {
          schema: CompanyPaymentInput.openapi('CompanyPaymentInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment applied',
      content: {
        'application/json': {
          schema: CompanyPaymentResponse.openapi('CompanyPaymentResponse'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    501: errorResponses[501],
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

companiesRoutes.openapi(listCompaniesRoute, async (c) => {
  const rows = await listCompanies({ isSystem: false });
  return c.json(rows.map(toCompanyDto), 200);
});

companiesRoutes.openapi(createCompanyPaymentRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');
  const { recipientPersonId, recipientCompanyId, amount, comment } = c.req.valid('json');

  const company = await findCompanyById(id);
  if (!company) {
    return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
  }
  if (user.role === 'head' && !(await ownsCompany(db, user.id, id))) {
    return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
  }

  if (recipientPersonId) {
    const person = await findPersonById(recipientPersonId);
    if (!person || !person.isOpen) {
      return apiError(c, 404, { code: 'not_found', message: 'Person not found' });
    }
  } else if (recipientCompanyId) {
    const recipientCompany = await findCompanyById(recipientCompanyId);
    if (!recipientCompany || recipientCompany.isSystem) {
      return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
    }
  } else {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'Specify exactly one of recipientPersonId / recipientCompanyId',
    });
  }

  const recipient = recipientPersonId
    ? ({ type: 'person', id: recipientPersonId } as const)
    : ({ type: 'company', id: recipientCompanyId as string } as const);

  try {
    const result = await ratings.payFromCompanyBudget({
      companyId: id,
      recipient,
      amount,
      actorUserId: user.id,
      ...(comment !== undefined && { comment }),
    });

    await writeAudit({
      actorUserId: user.id,
      action: 'company.payment',
      entityType: 'company',
      entityId: id,
      payload: {
        amount: result.tx.amount,
        recipient: { type: recipient.type, id: recipient.id },
        comment: comment ?? null,
        transactionId: result.tx.id,
      },
    });

    // Источник — всегда бюджет компании, поэтому `source` заведомо не null.
    if (!result.source || result.source.type !== 'company') {
      throw new Error('Company payment must debit a company budget');
    }
    return c.json(
      {
        company: ratings.toCompanyRatingDto(result.source.row),
        // Получателю-персонажу отдаём игровой DTO: скрытый мастерский модификатор
        // руководителю видеть нельзя.
        recipient:
          result.target.type === 'person'
            ? ratings.toPersonRatingDto(result.target.row, result.target.isStar)
            : ratings.toCompanyRatingDto(result.target.row),
        transaction: ratings.toTransactionDto(result.tx),
      },
      200,
    );
  } catch (err) {
    return handleRatingError(c, err);
  }
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
