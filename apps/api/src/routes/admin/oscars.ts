import { createRoute, z } from '@hono/zod-openapi';
import { type ApiError, OscarDto, Uuid } from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import { OscarError, oscarErrorStatus } from '../../modules/oscars/errors';
import * as oscars from '../../modules/oscars/oscars.service';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';

type AdminEnv = { Variables: AuthVariables };

const handleOscarError = (c: Context, err: unknown) => {
  if (err instanceof OscarError) {
    const status = oscarErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404 ? 'not_found' : status === 400 ? 'validation_error' : 'conflict';
    const body = {
      code: apiCode,
      message: err.message,
      details: { oscarCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам: c.json(body, <union>) склеивает статусы.
    switch (status) {
      case 400:
        return c.json(body, 400);
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
    }
  }
  throw err;
};

const awardRoute = createRoute({
  method: 'post',
  path: '/:id/award',
  tags: ['admin', 'oscars'],
  summary: 'Award Oscar (admin)',
  description:
    'Atomically marks oscar as winner and credits +OSCAR_WIN_PERSON_BONUS to person and +OSCAR_WIN_COMPANY_BONUS to film company. Idempotent: повторный вызов на ту же номинацию вернёт 409 already_awarded.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: Uuid }) },
  responses: {
    200: {
      description: 'Awarded',
      content: { 'application/json': { schema: OscarDto.openapi('OscarDto') } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: {
      ...errorResponses[409],
      description: 'Already awarded',
    },
    400: errorResponses[400],
  },
});

export const adminOscarsRoutes = createOpenAPIApp<AdminEnv>();

adminOscarsRoutes.use('*', requireAuth, requireRole('admin'));

adminOscarsRoutes.openapi(awardRoute, async (c) => {
  const { id } = c.req.valid('param');
  const user = c.get('user');
  try {
    const updated = await oscars.awardOscar({ oscarId: id, actorUserId: user.id });
    await writeAudit({
      actorUserId: user.id,
      action: 'oscar.award',
      entityType: 'oscar',
      entityId: id,
      payload: {
        nominationCode: updated.nominationCode,
        filmId: updated.filmId,
        personId: updated.personId,
      },
    });
    return c.json(oscars.toOscarDto(updated), 200);
  } catch (err) {
    return handleOscarError(c, err);
  }
});
