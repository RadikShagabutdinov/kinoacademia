import { createRoute, z } from '@hono/zod-openapi';
import { type ApiError, PersonRatingAdminDto, RandomizerApplyInput } from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import { RatingError, ratingErrorStatus } from '../../modules/ratings/errors';
import * as ratings from '../../modules/ratings/ratings.service';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';

type AdminEnv = { Variables: AuthVariables };

export const adminRandomizerRoutes = createOpenAPIApp<AdminEnv>();

adminRandomizerRoutes.use('*', requireAuth, requireRole('admin'));

const handleRatingError = (c: Context, err: unknown) => {
  if (err instanceof RatingError) {
    const status = ratingErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'validation_error';
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

const applyRandomizerRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Apply randomizer values',
  description:
    'Apply randomizer rating adjustments to persons. Creates "randomizer" transactions and updates person ratings. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: RandomizerApplyInput.openapi('RandomizerApplyInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Randomizer applied successfully',
      content: {
        'application/json': {
          schema: z.array(PersonRatingAdminDto).openapi('PersonRatingAdminList'),
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

const cancelRandomizerRoute = createRoute({
  method: 'delete',
  path: '/',
  tags: ['admin'],
  summary: 'Cancel randomizer',
  description:
    'Cancel all active randomizer adjustments. Reverts randomizer values to zero for all persons. Admin role required.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Randomizer cancelled successfully',
      content: {
        'application/json': {
          schema: z.array(PersonRatingAdminDto).openapi('PersonRatingAdminList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
    400: errorResponses[400],
    404: errorResponses[404],
    501: errorResponses[501],
  },
});

adminRandomizerRoutes.openapi(applyRandomizerRoute, async (c) => {
  const user = c.get('user') as AuthVariables['user'];
  const { values } = c.req.valid('json');

  try {
    const updated = await ratings.randomizerApply({
      values,
      actorUserId: user.id,
    });
    await writeAudit({
      actorUserId: user.id,
      action: 'randomizer.apply',
      entityType: 'randomizer',
      payload: { count: values.length, values },
    });
    return c.json(
      updated.map((r) => ratings.toPersonRatingAdminDto(r, false)),
      200,
    );
  } catch (err) {
    return handleRatingError(c, err);
  }
});

adminRandomizerRoutes.openapi(cancelRandomizerRoute, async (c) => {
  const user = c.get('user') as AuthVariables['user'];
  try {
    const updated = await ratings.randomizerCancel(user.id);
    await writeAudit({
      actorUserId: user.id,
      action: 'randomizer.cancel',
      entityType: 'randomizer',
      payload: { count: updated.length },
    });
    return c.json(
      updated.map((r) => ratings.toPersonRatingAdminDto(r, false)),
      200,
    );
  } catch (err) {
    return handleRatingError(c, err);
  }
});
