import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  ContractActionInput,
  ContractDto,
  ContractKind,
  ContractStatusHistoryDto,
  ContractsHistoryQuery,
  CreateContractInput,
  Uuid,
} from '@kinoacademia/shared';
import type { Context, Env as HonoEnv } from 'hono';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import { findCompanyById } from '../modules/companies/companies-repo';
import * as contracts from '../modules/contracts/contracts.service';
import { ContractError, contractErrorStatus } from '../modules/contracts/errors';
import { findOpenPersonByUserId } from '../modules/persons/persons-repo';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';

type Env = { Variables: AuthVariables };

const handleContractError = (c: Context, err: unknown) => {
  if (err instanceof ContractError) {
    const status = contractErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'conflict';
    const body = {
      code: apiCode,
      message: err.message,
      details: { contractCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам обязательно: c.json(body, <union>) склеивает
    // статусы в одно поле _status, и ответ перестаёт подходить под роут.
    switch (status) {
      case 403:
        return c.json(body, 403);
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
    }
  }
  throw err;
};

// Возвращаемый тип выводится намеренно: явная аннотация `Promise<true | Response>`
// стирала статусы ответов, и обработчики переставали подходить под роут.
const ensureCompanyAccess = async (c: Context, companyId: string) => {
  const user = c.get('user') as AuthVariables['user'];
  const company = await findCompanyById(companyId);
  if (!company) {
    return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
  }
  if (user.role === 'head') {
    const owns = await ownsCompany(db, user.id, companyId);
    if (!owns) {
      return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
    }
  }
  return true;
};

const ContractPathParams = z.object({
  kind: ContractKind,
  id: Uuid,
});

const CompanyContractPathParams = z.object({
  companyId: Uuid,
  kind: ContractKind,
  id: Uuid,
});

const CompanyIdParam = z.object({
  companyId: Uuid,
});

/**
 * Контексты общих фабрик-обработчиков. Голый `Context` не знает, что схема
 * роута уже провалидировала params и body, и `c.req.valid()` вырождается
 * в `never` — поэтому валидированный вход описан явно.
 */
type ValidatedCtx<P extends z.ZodTypeAny> = Context<
  // Роуты с `middleware` в определении получают env, пересечённый с окружением
  // middleware, поэтому здесь тот же вид пересечения.
  { Variables: AuthVariables } & HonoEnv,
  string,
  {
    in: { param: z.input<P>; json: z.input<typeof ContractActionInput> };
    out: { param: z.output<P>; json: z.output<typeof ContractActionInput> };
  }
>;

type PersonActionCtx = ValidatedCtx<typeof ContractPathParams>;
type CompanyActionCtx = ValidatedCtx<typeof CompanyContractPathParams>;

const getMyContractsRoute = createRoute({
  method: 'get',
  path: '/my',
  tags: ['contracts'],
  summary: 'Get my contracts',
  description:
    "List all contracts for the currently authenticated user's active person. Returns empty array if user has no active person.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of contracts',
      content: {
        'application/json': {
          schema: z.array(ContractDto).openapi('ContractList'),
        },
      },
    },
    401: errorResponses[401],
  },
});

const confirmRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/confirm',
  tags: ['contracts'],
  summary: 'Person confirms contract',
  description:
    'Person confirms contract offer (draft -> confirmed). See contract state diagram in README for valid transitions.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract confirmed successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: {
      ...errorResponses[409],
      description: 'Contract state conflict (invalid transition, duplicate permanent, etc.)',
    },
  },
});

const rejectRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/reject',
  tags: ['contracts'],
  summary: 'Person rejects contract',
  description:
    'Person rejects contract offer (sent -> rejected). See contract state diagram in README.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract rejected successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const breakByPersonRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/break',
  tags: ['contracts'],
  summary: 'Person breaks contract unilaterally',
  description:
    'Person breaks permanent contract unilaterally (confirmed -> broken_person). Applies penalty. See contract state diagram in README.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract broken successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const myRequestEndRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/request-end',
  tags: ['contracts'],
  summary: 'Person requests contract end',
  description:
    'Person requests end of contract by mutual consent (confirmed -> breakup_sent). Requires company confirmation.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end request sent successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const confirmEndRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/confirm-end',
  tags: ['contracts'],
  summary: 'Person confirms contract end',
  description:
    'Person confirms end-of-contract request (breakup_sent -> breakup_confirmed). See contract state diagram in README.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end confirmed successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const rejectEndRoute = createRoute({
  method: 'post',
  path: '/my/:kind/:id/reject-end',
  tags: ['contracts'],
  summary: 'Person rejects contract end',
  description:
    'Person rejects end-of-contract request (breakup_sent -> breakup_rejected). See contract state diagram in README.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end rejected successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const getContractsHistoryRoute = createRoute({
  middleware: [requireRole('info', 'admin')] as const,
  method: 'get',
  path: '/history',
  tags: ['contracts'],
  summary: 'List contract status transitions (info monitor)',
  description:
    'Сводная история переходов статусов контрактов с join по компании и персонажу. Доступно только ролям info и admin. Поддерживает фильтры по companyId и personId.',
  security: [{ cookieAuth: [] }],
  request: {
    query: ContractsHistoryQuery,
  },
  responses: {
    200: {
      description: 'Лента переходов статусов',
      content: {
        'application/json': {
          schema: z.array(ContractStatusHistoryDto).openapi('ContractStatusHistoryList'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const getCompanyContractsRoute = createRoute({
  middleware: [requireRole('head', 'admin', 'info')] as const,
  method: 'get',
  path: '/company/:companyId',
  tags: ['contracts'],
  summary: 'Get company contracts',
  description:
    'List all contracts for a company. Head users can only access their own company. Admin and info roles can access any company.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
  },
  responses: {
    200: {
      description: 'List of company contracts',
      content: {
        'application/json': {
          schema: z.array(ContractDto).openapi('ContractList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const createContractRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId',
  tags: ['contracts'],
  summary: 'Create contract draft',
  description:
    'Create new contract draft for a company. Validates that person exists and no duplicate permanent contracts exist. Head or admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyIdParam,
    body: {
      content: {
        'application/json': {
          schema: CreateContractInput.openapi('CreateContractInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Contract draft created successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const submitRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId/:kind/:id/submit',
  tags: ['contracts'],
  summary: 'Company submits contract',
  description:
    'Company submits contract to person for confirmation (draft -> sent). Head or admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract submitted successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const breakByCompanyRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId/:kind/:id/break',
  tags: ['contracts'],
  summary: 'Company breaks contract unilaterally',
  description:
    'Company breaks permanent contract unilaterally (confirmed -> broken_company). Applies penalty. Head or admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract broken successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const companyConfirmEndRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId/:kind/:id/confirm-end',
  tags: ['contracts'],
  summary: 'Company confirms contract end',
  description:
    "Company confirms person's end-of-contract request (breakup_sent -> breakup_confirmed). Head or admin role required.",
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end confirmed successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const companyRejectEndRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId/:kind/:id/reject-end',
  tags: ['contracts'],
  summary: 'Company rejects contract end',
  description:
    "Company rejects person's end-of-contract request (breakup_sent -> breakup_rejected). Head or admin role required.",
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end rejected successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const requestEndRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/company/:companyId/:kind/:id/request-end',
  tags: ['contracts'],
  summary: 'Company requests contract end',
  description:
    'Company requests end of permanent contract (confirmed -> breakup_sent). Requires person confirmation. Head or admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: CompanyContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ContractActionInput.openapi('ContractActionInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract end request sent successfully',
      content: {
        'application/json': {
          schema: ContractDto.openapi('ContractDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

export const contractsRoutes = createOpenAPIApp<Env>();

contractsRoutes.use('*', requireAuth);

contractsRoutes.openapi(getMyContractsRoute, async (c) => {
  const user = c.get('user');
  const person = await findOpenPersonByUserId(user.id);
  if (!person) return c.json([], 200);
  const rows = await contracts.listMyContracts(person.id);
  return c.json(rows.map(contracts.toContractDto), 200);
});

const personActionHandler =
  (action: (input: contracts.ActionInput) => Promise<unknown>) => async (c: PersonActionCtx) => {
    const user = c.get('user') as AuthVariables['user'];
    const { kind, id } = c.req.valid('param');
    const body = c.req.valid('json');

    try {
      const person = await findOpenPersonByUserId(user.id);
      if (!person) {
        return apiError(c, 403, { code: 'forbidden', message: 'No active person' });
      }
      const contract = await contracts.findContract(kind, id);
      if (!contract) {
        return apiError(c, 404, { code: 'not_found', message: 'Contract not found' });
      }
      if (contract.personId !== person.id) {
        return apiError(c, 403, { code: 'forbidden', message: 'Not your contract' });
      }
      const updated = (await action({
        kind,
        id,
        actorUserId: user.id,
        side: 'person',
        ...(body.comment !== undefined && { comment: body.comment }),
      })) as Awaited<ReturnType<typeof contracts.confirm>>;
      return c.json(contracts.toContractDto(updated), 200);
    } catch (err) {
      return handleContractError(c, err);
    }
  };

contractsRoutes.openapi(confirmRoute, personActionHandler(contracts.confirm));
contractsRoutes.openapi(rejectRoute, personActionHandler(contracts.reject));
contractsRoutes.openapi(breakByPersonRoute, personActionHandler(contracts.breakByPerson));
contractsRoutes.openapi(myRequestEndRoute, personActionHandler(contracts.requestEnd));
contractsRoutes.openapi(confirmEndRoute, personActionHandler(contracts.confirmEnd));
contractsRoutes.openapi(rejectEndRoute, personActionHandler(contracts.rejectEnd));

contractsRoutes.openapi(getContractsHistoryRoute, async (c) => {
  const { companyId, personId, branchCode, limit } = c.req.valid('query');
  const rows = await contracts.listStatusHistory({
    ...(companyId !== undefined && { companyId }),
    ...(personId !== undefined && { personId }),
    ...(branchCode !== undefined && { branchCode }),
    ...(limit !== undefined && { limit }),
  });
  return c.json(rows.map(contracts.toHistoryDto), 200);
});

contractsRoutes.openapi(getCompanyContractsRoute, async (c) => {
  const { companyId } = c.req.valid('param');
  const access = await ensureCompanyAccess(c, companyId);
  if (access !== true) return access;
  const rows = await contracts.listCompanyContracts(companyId);
  return c.json(rows.map(contracts.toContractDto), 200);
});

contractsRoutes.openapi(createContractRoute, async (c) => {
  const { companyId } = c.req.valid('param');
  const access = await ensureCompanyAccess(c, companyId);
  if (access !== true) return access;

  const user = c.get('user') as AuthVariables['user'];
  const data = c.req.valid('json');

  if (data.companyId !== companyId) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'companyId in path and body must match',
    });
  }

  // Системная компания хранит только типовые сканы — контрактов у неё не бывает.
  const company = await findCompanyById(companyId);
  if (company?.isSystem) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'System company cannot have contracts',
    });
  }

  try {
    const created = await contracts.createDraft({
      kind: data.kind,
      personId: data.personId,
      companyId,
      actorUserId: user.id,
    });
    return c.json(contracts.toContractDto(created), 201);
  } catch (err) {
    return handleContractError(c, err);
  }
});

const companyActionHandler =
  (action: (input: contracts.ActionInput) => Promise<unknown>) => async (c: CompanyActionCtx) => {
    const { companyId, kind, id } = c.req.valid('param');
    const access = await ensureCompanyAccess(c, companyId);
    if (access !== true) return access;

    const body = c.req.valid('json');

    try {
      const contract = await contracts.findContract(kind, id);
      if (!contract) {
        return apiError(c, 404, { code: 'not_found', message: 'Contract not found' });
      }
      if (contract.companyId !== companyId) {
        return apiError(c, 404, {
          code: 'not_found',
          message: 'Contract not found in this company',
        });
      }
      const user = c.get('user') as AuthVariables['user'];
      const updated = (await action({
        kind,
        id,
        actorUserId: user.id,
        side: 'company',
        ...(body.comment !== undefined && { comment: body.comment }),
      })) as Awaited<ReturnType<typeof contracts.confirm>>;
      return c.json(contracts.toContractDto(updated), 200);
    } catch (err) {
      return handleContractError(c, err);
    }
  };

contractsRoutes.openapi(submitRoute, companyActionHandler(contracts.submit));
contractsRoutes.openapi(breakByCompanyRoute, companyActionHandler(contracts.breakByCompany));
contractsRoutes.openapi(requestEndRoute, companyActionHandler(contracts.requestEnd));
contractsRoutes.openapi(companyConfirmEndRoute, companyActionHandler(contracts.confirmEnd));
contractsRoutes.openapi(companyRejectEndRoute, companyActionHandler(contracts.rejectEnd));
