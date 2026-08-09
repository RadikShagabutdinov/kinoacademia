import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  ContractDto,
  ContractKind,
  ForceBreakContractInput,
  Uuid,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import * as contracts from '../../modules/contracts/contracts.service';
import { ContractError, contractErrorStatus } from '../../modules/contracts/errors';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';

type AdminEnv = { Variables: AuthVariables };

const handleContractError = (c: Context, err: unknown) => {
  if (err instanceof ContractError) {
    const status = contractErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'conflict';
    return c.json(
      {
        code: apiCode,
        message: err.message,
        details: { contractCode: err.code },
      } satisfies ApiError,
      status,
    );
  }
  throw err;
};

const ContractPathParams = z.object({
  kind: ContractKind,
  id: Uuid,
});

const listActiveContractsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List active contracts',
  description: 'List contracts that are not ended and can be force-broken. Admin only.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Active contracts',
      content: {
        'application/json': {
          schema: z.array(ContractDto).openapi('ActiveContractList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const forceBreakRoute = createRoute({
  method: 'post',
  path: '/:kind/:id/force-break',
  tags: ['admin'],
  summary: 'Force break contract',
  description:
    'Administrative force-break without state machine transitions. Optionally applies permanent break penalty.',
  security: [{ cookieAuth: [] }],
  request: {
    params: ContractPathParams,
    body: {
      content: {
        'application/json': {
          schema: ForceBreakContractInput.openapi('ForceBreakContractInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Contract force-broken',
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

export const adminContractsRoutes = createOpenAPIApp<AdminEnv>();

adminContractsRoutes.use('*', requireAuth, requireRole('admin'));

adminContractsRoutes.openapi(listActiveContractsRoute, async (c) => {
  const rows = await contracts.listActiveContracts();
  return c.json(rows.map(contracts.toContractDto), 200);
});

adminContractsRoutes.openapi(forceBreakRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { kind, id } = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const row = await contracts.forceBreakByAdmin({
      kind,
      id,
      side: body.side,
      actorUserId: actor.id,
      applyPenalty: body.applyPenalty,
      // Поле опциональное: при exactOptionalPropertyTypes передать явный undefined нельзя.
      ...(body.comment !== undefined && { comment: body.comment }),
    });
    return c.json(contracts.toContractDto(row), 200);
  } catch (err) {
    return handleContractError(c, err);
  }
});
