import { createRoute, z } from '@hono/zod-openapi';
import {
  CompanyRatingDto,
  ManualRatingInput,
  PersonRatingAdminDto,
  type RatingSlot,
  RatingTransactionDto,
} from '@kinoacademia/shared';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import * as ratings from '../../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../../openapi/app';
import { apiError, errorResponses } from '../../openapi/responses';
import { handleRatingError } from '../rating-error';

type AdminEnv = { Variables: AuthVariables };

export const adminTransactionsRoutes = createOpenAPIApp<AdminEnv>();

adminTransactionsRoutes.use('*', requireAuth, requireRole('admin'));

const ManualRatingSideDto = z.union([PersonRatingAdminDto, CompanyRatingDto]);

const ManualTransactionResponse = z.object({
  target: ManualRatingSideDto,
  source: ManualRatingSideDto.nullable(),
  transaction: RatingTransactionDto,
});

const createManualTransactionRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Create manual rating transaction',
  description:
    'Create manual rating transaction. Credits the target slot (person permanent/variable, company permanent/budget) and, when a source is given, debits the same amount from it; without a source the rating comes from admin resources. Admin role required. See rating formulas in README for details.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ManualRatingInput.openapi('ManualRatingInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Transaction created successfully',
      content: {
        'application/json': {
          schema: ManualTransactionResponse.openapi('ManualTransactionResponse'),
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

/** Схема ввода уже гарантирует ровно одну заполненную сторону; `null` — страховка на случай обхода. */
const toParty = (side: {
  personId?: string | undefined;
  companyId?: string | undefined;
  slot: RatingSlot;
}): ratings.ManualTxParty | null => {
  if (side.personId) return { type: 'person', id: side.personId, slot: side.slot };
  if (side.companyId) return { type: 'company', id: side.companyId, slot: side.slot };
  return null;
};

const serializeSide = (side: ratings.ManualTxPartyRow) =>
  side.type === 'person'
    ? ratings.toPersonRatingAdminDto(side.row, side.isStar)
    : ratings.toCompanyRatingDto(side.row);

adminTransactionsRoutes.openapi(createManualTransactionRoute, async (c) => {
  const user = c.get('user') as AuthVariables['user'];
  const { to, from, amount, mode, comment } = c.req.valid('json');

  const target = toParty(to);
  const source = from ? toParty(from) : null;
  if (!target || (from && !source)) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'Specify exactly one of personId / companyId on each side',
    });
  }

  try {
    const result = await ratings.manualTransaction({
      to: { ...target, kind: to.kind },
      ...(source && { from: source }),
      amount,
      mode,
      actorUserId: user.id,
      ...(comment !== undefined && { comment }),
    });

    await writeAudit({
      actorUserId: user.id,
      action: 'transaction.manual',
      entityType: target.type,
      entityId: target.id,
      payload: {
        amount: result.tx.amount,
        mode,
        kind: result.tx.kind,
        toSlot: target.slot,
        from: source && { type: source.type, id: source.id, slot: source.slot },
        comment: comment ?? null,
        transactionId: result.tx.id,
      },
    });

    return c.json(
      {
        target: serializeSide(result.target),
        source: result.source ? serializeSide(result.source) : null,
        transaction: ratings.toTransactionDto(result.tx),
      },
      200,
    );
  } catch (err) {
    return handleRatingError(c, err);
  }
});
