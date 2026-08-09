import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  CreateFilmAssignmentInput,
  CreateFilmInput,
  FilmAssignmentDetailDto,
  FilmDto,
  FilmWithAssignmentsDto,
  Uuid,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { AuthVariables } from '../auth/middleware';
import { requireAuth, requireRole } from '../auth/middleware';
import { ownsCompany } from '../auth/ownership';
import { db } from '../db/client';
import { writeAudit } from '../modules/audit/audit-repo';
import { findCompanyById } from '../modules/companies/companies-repo';
import { FilmError, filmErrorStatus } from '../modules/films/errors';
import * as films from '../modules/films/films.service';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';

type Env = { Variables: AuthVariables };

const handleFilmError = (c: Context, err: unknown) => {
  if (err instanceof FilmError) {
    const status = filmErrorStatus(err.code);
    const apiCode: ApiError['code'] = status === 404 ? 'not_found' : 'conflict';
    const body = {
      code: apiCode,
      message: err.message,
      details: { filmCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам обязательно: c.json(body, <union>) склеивает
    // статусы в одно поле _status, и ответ перестаёт подходить под роут.
    switch (status) {
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
    }
  }
  throw err;
};

// Тип выводится: явный Response стирал статусы ответов.
const ensureCompanyAccess = async (c: Context, companyId: string) => {
  const user = c.get('user') as AuthVariables['user'];
  const company = await findCompanyById(companyId);
  if (!company) {
    return apiError(c, 404, { code: 'not_found', message: 'Company not found' });
  }
  if (company.branchCode !== 'cinema') {
    return apiError(c, 409, {
      code: 'conflict',
      message: 'Company branch must be cinema',
      details: { filmCode: 'not_cinema' },
    });
  }
  if (user.role === 'head') {
    const owns = await ownsCompany(db, user.id, companyId);
    if (!owns) {
      return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
    }
  }
  return true;
};

const FilmIdParam = z.object({ id: Uuid });
const CompanyIdParam = z.object({ companyId: Uuid });

const createFilmRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/',
  tags: ['films'],
  summary: 'Create a film',
  description: 'Create a new film. Available to head (own cinema company) and admin.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateFilmInput.openapi('CreateFilmInput') } },
    },
  },
  responses: {
    201: {
      description: 'Film created',
      content: { 'application/json': { schema: FilmDto.openapi('FilmDto') } },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const addAssignmentRoute = createRoute({
  middleware: [requireRole('head', 'admin')] as const,
  method: 'post',
  path: '/:id/assignments',
  tags: ['films'],
  summary: 'Add film participant',
  description: 'Assign a person to film with a specific role. Head/admin.',
  security: [{ cookieAuth: [] }],
  request: {
    params: FilmIdParam,
    body: {
      content: {
        'application/json': {
          schema: CreateFilmAssignmentInput.openapi('CreateFilmAssignmentInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Assignment created',
      content: {
        'application/json': { schema: FilmAssignmentDetailDto.openapi('FilmAssignmentDetailDto') },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const listAllFilmsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['films'],
  summary: 'List all films (info/admin/head)',
  description: 'For info/admin: all films. For head: only films of own cinema company.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of films',
      content: {
        'application/json': {
          schema: z.array(FilmDto.extend({ companyName: z.string() })).openapi('FilmList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const listCompanyFilmsRoute = createRoute({
  method: 'get',
  path: '/company/:companyId',
  tags: ['films'],
  summary: 'Films of a company',
  security: [{ cookieAuth: [] }],
  request: { params: CompanyIdParam },
  responses: {
    200: {
      description: 'List of films',
      content: {
        'application/json': {
          schema: z.array(FilmDto.extend({ companyName: z.string() })).openapi('FilmList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const getFilmRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['films'],
  summary: 'Film details with assignments',
  security: [{ cookieAuth: [] }],
  request: { params: FilmIdParam },
  responses: {
    200: {
      description: 'Film with assignments',
      content: {
        'application/json': { schema: FilmWithAssignmentsDto.openapi('FilmWithAssignmentsDto') },
      },
    },
    401: errorResponses[401],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

export const filmsRoutes = createOpenAPIApp<Env>();

filmsRoutes.use('*', requireAuth);

filmsRoutes.openapi(createFilmRoute, async (c) => {
  const data = c.req.valid('json');
  const access = await ensureCompanyAccess(c, data.companyId);
  if (access !== true) return access;

  const user = c.get('user');
  try {
    const created = await films.createFilm(data);
    await writeAudit({
      actorUserId: user.id,
      action: 'film.create',
      entityType: 'film',
      entityId: created.id,
      payload: { companyId: created.companyId, title: created.title },
    });
    return c.json(films.toFilmDto(created), 201);
  } catch (err) {
    return handleFilmError(c, err);
  }
});

filmsRoutes.openapi(addAssignmentRoute, async (c) => {
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');
  if (data.filmId !== id) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'filmId in path and body must match',
    });
  }

  const user = c.get('user');
  try {
    const film = await films.findFilmById(id);
    if (!film) return apiError(c, 404, { code: 'not_found', message: 'Film not found' });

    if (user.role === 'head') {
      const owns = await ownsCompany(db, user.id, film.companyId);
      if (!owns) return apiError(c, 403, { code: 'forbidden', message: 'Not your company' });
    }

    const { assignment } = await films.addAssignment(data);
    await writeAudit({
      actorUserId: user.id,
      action: 'film.assignment.create',
      entityType: 'film',
      entityId: id,
      payload: { personId: data.personId, role: data.role },
    });
    return c.json(films.toAssignmentDetailDto(assignment), 201);
  } catch (err) {
    return handleFilmError(c, err);
  }
});

filmsRoutes.openapi(listAllFilmsRoute, async (c) => {
  const user = c.get('user');
  if (user.role === 'admin' || user.role === 'info') {
    const rows = await films.listAllFilms();
    return c.json(
      rows.map((r) => ({ ...films.toFilmDto(r), companyName: r.companyName })),
      200,
    );
  }
  if (user.role === 'head') {
    const { findCompanyByHeadUserId } = await import('../modules/companies/companies-repo');
    const company = await findCompanyByHeadUserId(user.id);
    if (!company) return c.json([], 200);
    const rows = await films.listCompanyFilms(company.id);
    return c.json(
      rows.map((r) => ({ ...films.toFilmDto(r), companyName: r.companyName })),
      200,
    );
  }
  return apiError(c, 403, { code: 'forbidden', message: 'Insufficient role' });
});

filmsRoutes.openapi(listCompanyFilmsRoute, async (c) => {
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
  const rows = await films.listCompanyFilms(companyId);
  return c.json(
    rows.map((r) => ({ ...films.toFilmDto(r), companyName: r.companyName })),
    200,
  );
});

filmsRoutes.openapi(getFilmRoute, async (c) => {
  const { id } = c.req.valid('param');
  try {
    const { film, assignments } = await films.getFilmWithAssignments(id);
    return c.json(films.toFilmWithAssignmentsDto(film, assignments), 200);
  } catch (err) {
    return handleFilmError(c, err);
  }
});
