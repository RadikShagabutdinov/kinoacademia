import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  CompanyRatingDto,
  ManualRatingInput,
  PersonRatingAdminDto,
  RatingTransactionDto,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import { RatingError, ratingErrorStatus } from '../../modules/ratings/errors';
import * as ratings from '../../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../../openapi/app';
import { apiError, errorResponses } from '../../openapi/responses';

type AdminEnv = { Variables: AuthVariables };

export const adminTransactionsRoutes = createOpenAPIApp<AdminEnv>();

adminTransactionsRoutes.use('*', requireAuth, requireRole('admin'));

const handleRatingError = (c: Context, err: unknown) => {
  if (err instanceof RatingError) {
    const status = ratingErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404
        ? 'not_found'
        : status === 409
          ? 'conflict'
          : status === 501
            ? 'internal_error'
            : 'validation_error';
    const body = {
      code: apiCode,
      message: err.message,
      details: { ratingCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам: c.json(body, <union>) склеивает статусы.
    switch (status) {
      case 400:
        return c.json(body, 400);
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
      case 501:
        return c.json(body, 501);
    }
  }
  throw err;
};

const ManualTransactionResponse = z.union([
  z.object({
    rating: PersonRatingAdminDto,
    transaction: RatingTransactionDto,
  }),
  z.object({
    rating: CompanyRatingDto,
    transaction: RatingTransactionDto,
  }),
]);

const createManualTransactionRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Create manual rating transaction',
  description:
    'Create manual rating transaction for person or company. Supports absolute/percent modes and manual/oscar/penalty kinds. Admin role required. See rating formulas in README for details.',
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

adminTransactionsRoutes.openapi(createManualTransactionRoute, async (c) => {
  const user = c.get('user') as AuthVariables['user'];
  const { targetPersonId, targetCompanyId, amount, mode, kind, comment } = c.req.valid('json');

  try {
    if (targetPersonId) {
      if (kind === 'budget') {
        return apiError(c, 400, {
          code: 'validation_error',
          message: 'Kind "budget" applies to a company only',
        });
      }
      const result = await ratings.manualPersonTransaction({
        personId: targetPersonId,
        amount,
        mode,
        kind,
        actorUserId: user.id,
        ...(comment !== undefined && { comment }),
      });
      await writeAudit({
        actorUserId: user.id,
        action: 'transaction.manual',
        entityType: 'person',
        entityId: targetPersonId,
        payload: { amount, mode, kind, comment: comment ?? null, transactionId: result.tx.id },
      });
      const { isStar } = await ratings.getPersonRating(targetPersonId);
      return c.json(
        {
          rating: ratings.toPersonRatingAdminDto(result.row, isStar),
          transaction: ratings.toTransactionDto(result.tx),
        },
        200,
      );
    }

    if (targetCompanyId) {
      if (kind === 'base') {
        return apiError(c, 400, {
          code: 'validation_error',
          message: 'Kind "base" applies to a person only',
        });
      }
      const result = await ratings.manualCompanyTransaction({
        companyId: targetCompanyId,
        amount,
        mode,
        kind,
        actorUserId: user.id,
        ...(comment !== undefined && { comment }),
      });
      await writeAudit({
        actorUserId: user.id,
        action: 'transaction.manual',
        entityType: 'company',
        entityId: targetCompanyId,
        payload: { amount, mode, kind, comment: comment ?? null, transactionId: result.tx.id },
      });
      return c.json(
        {
          rating: ratings.toCompanyRatingDto(result.row),
          transaction: ratings.toTransactionDto(result.tx),
        },
        200,
      );
    }

    return apiError(c, 400, {
      code: 'validation_error',
      message: 'Specify exactly one target',
    });
  } catch (err) {
    return handleRatingError(c, err);
  }
});
