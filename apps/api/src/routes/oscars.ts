import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  CreateOscarNominationInput,
  OscarDto,
  OscarNominationDetailDto,
  OscarWithdrawResultDto,
  Uuid,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import { writeAudit } from '../modules/audit/audit-repo';
import { findCompanyById } from '../modules/companies/companies-repo';
import { findFilmById } from '../modules/films/films.service';
import { OscarError, oscarErrorStatus } from '../modules/oscars/errors';
import * as oscars from '../modules/oscars/oscars.service';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';

type Env = { Variables: AuthVariables };

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
    // Разветвление по литералам обязательно: c.json(body, <union>) склеивает
    // статусы в одно поле _status, и ответ перестаёт подходить под роут.
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

const submitNominationRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/nominations',
  tags: ['oscars'],
  summary: 'Submit Oscar nomination',
  description:
    'Подача номинации от лица кинокомпании (head) или admin. Закрытая категория `contribution` доступна только администратору и не привязывается к фильму.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOscarNominationInput.openapi('CreateOscarNominationInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Nomination created',
      content: { 'application/json': { schema: OscarDto.openapi('OscarDto') } },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const withdrawNominationRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'delete',
  path: '/nominations/:id',
  tags: ['oscars'],
  summary: 'Withdraw Oscar nomination',
  description:
    'Отзыв поданной номинации: строка удаляется, компании возвращается стоимость верхней ступени шкалы. head — только по своей компании, admin — любую. Победившую номинацию отозвать нельзя.',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: Uuid }) },
  responses: {
    200: {
      description: 'Nomination withdrawn',
      content: {
        'application/json': { schema: OscarWithdrawResultDto.openapi('OscarWithdrawResultDto') },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const listAllRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['oscars'],
  summary: 'List all nominations',
  description: 'For info/admin: all. For head: only of own company.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of nominations with join fields',
      content: {
        'application/json': {
          schema: z.array(OscarNominationDetailDto).openapi('OscarNominationList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const listByCompanyRoute = createRoute({
  method: 'get',
  path: '/company/:companyId',
  tags: ['oscars'],
  summary: 'Nominations of a company',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ companyId: Uuid }) },
  responses: {
    200: {
      description: 'List of nominations',
      content: {
        'application/json': {
          schema: z.array(OscarNominationDetailDto).openapi('OscarNominationList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const listByPersonRoute = createRoute({
  method: 'get',
  path: '/person/:personId',
  tags: ['oscars'],
  summary: 'Nominations of a person',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ personId: Uuid }) },
  responses: {
    200: {
      description: 'List of nominations',
      content: {
        'application/json': {
          schema: z.array(OscarNominationDetailDto).openapi('OscarNominationList'),
        },
      },
    },
    401: errorResponses[401],
  },
});

const listByFilmRoute = createRoute({
  method: 'get',
  path: '/film/:filmId',
  tags: ['oscars'],
  summary: 'Nominations of a film',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ filmId: Uuid }) },
  responses: {
    200: {
      description: 'List of nominations',
      content: {
        'application/json': {
          schema: z.array(OscarNominationDetailDto).openapi('OscarNominationList'),
        },
      },
    },
    401: errorResponses[401],
  },
});

export const oscarsRoutes = createOpenAPIApp<Env>();

oscarsRoutes.use('*', requireAuth);

oscarsRoutes.openapi(submitNominationRoute, async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  // head: проверка владения компанией фильма (если filmId указан).
  if (user.role === 'head') {
    if (!data.filmId) {
      return apiError(c, 400, {
        code: 'validation_error',
        message: 'filmId is required for head role',
      });
    }
    const film = await findFilmById(data.filmId);
    if (!film) return apiError(c, 404, { code: 'not_found', message: 'Film not found' });
    const owns = await ownsCompany(db, user.id, film.companyId);
    if (!owns) return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
  }

  try {
    const created = await oscars.submitNomination({
      ...data,
      actorUserId: user.id,
      allowClosed: user.role === 'admin',
      chargeCompany: user.role !== 'admin',
    });
    await writeAudit({
      actorUserId: user.id,
      action: 'oscar.nominate',
      entityType: 'oscar',
      entityId: created.id,
      payload: {
        nominationCode: created.nominationCode,
        filmId: created.filmId,
        personId: created.personId,
      },
    });
    return c.json(oscars.toOscarDto(created), 201);
  } catch (err) {
    return handleOscarError(c, err);
  }
});

oscarsRoutes.openapi(withdrawNominationRoute, async (c) => {
  const user = c.get('user');
  const { id } = c.req.valid('param');

  const nomination = await oscars.findOscarById(id);
  if (!nomination) return apiError(c, 404, { code: 'not_found', message: 'Nomination not found' });

  // head отзывает только номинации своей компании; закрытая `contribution` без
  // фильма к компании не привязана, поэтому доступна только админу.
  if (user.role === 'head') {
    if (!nomination.filmId) {
      return apiError(c, 403, { code: 'forbidden', message: 'Not your nomination' });
    }
    const film = await findFilmById(nomination.filmId);
    if (!film) return apiError(c, 404, { code: 'not_found', message: 'Film not found' });
    const owns = await ownsCompany(db, user.id, film.companyId);
    if (!owns) return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
  }

  try {
    const { refunded } = await oscars.withdrawNomination({ oscarId: id, actorUserId: user.id });
    await writeAudit({
      actorUserId: user.id,
      action: 'oscar.withdraw',
      entityType: 'oscar',
      entityId: id,
      payload: {
        nominationCode: nomination.nominationCode,
        filmId: nomination.filmId,
        personId: nomination.personId,
        refunded,
      },
    });
    return c.json({ id, refunded }, 200);
  } catch (err) {
    return handleOscarError(c, err);
  }
});

oscarsRoutes.openapi(listAllRoute, async (c) => {
  const user = c.get('user');
  if (user.role === 'info' || user.role === 'admin') {
    const rows = await oscars.listAllDetail();
    return c.json(rows.map(oscars.toOscarDetailDto), 200);
  }
  if (user.role === 'head') {
    const { findCompanyByHeadUserId } = await import('../modules/companies/companies-repo');
    const company = await findCompanyByHeadUserId(user.id);
    if (!company) return c.json([], 200);
    const rows = await oscars.listByCompanyDetail(company.id);
    return c.json(rows.map(oscars.toOscarDetailDto), 200);
  }
  return apiError(c, 403, { code: 'forbidden', message: 'Insufficient role' });
});

oscarsRoutes.openapi(listByCompanyRoute, async (c) => {
  const { companyId } = c.req.valid('param');
  const user = c.get('user');
  const company = await findCompanyById(companyId);
  if (!company) return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
  if (user.role === 'head') {
    const owns = await ownsCompany(db, user.id, companyId);
    if (!owns) return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
  } else if (user.role !== 'admin' && user.role !== 'info') {
    return apiError(c, 403, { code: 'forbidden', message: 'Insufficient role' });
  }
  const rows = await oscars.listByCompanyDetail(companyId);
  return c.json(rows.map(oscars.toOscarDetailDto), 200);
});

oscarsRoutes.openapi(listByPersonRoute, async (c) => {
  const { personId } = c.req.valid('param');
  const rows = await oscars.listByPersonDetail(personId);
  return c.json(rows.map(oscars.toOscarDetailDto), 200);
});

oscarsRoutes.openapi(listByFilmRoute, async (c) => {
  const { filmId } = c.req.valid('param');
  const rows = await oscars.listByFilmDetail(filmId);
  return c.json(rows.map(oscars.toOscarDetailDto), 200);
});
