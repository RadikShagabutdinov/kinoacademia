import { createRoute, z } from '@hono/zod-openapi';
import {
  AdminPersonDto,
  type ApiError,
  CreatePersonInput,
  PersonDossierDto,
  UpdatePersonInput,
  Uuid,
} from '@kinoacademia/shared';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { writeAudit } from '../../modules/audit/audit-repo';
import {
  closePerson,
  createPerson,
  findOpenPersonByUserId,
  findPersonById,
  findPersonDossier,
  listPersons,
  openPerson,
  toAdminPersonDto,
  updatePerson,
} from '../../modules/persons/persons-repo';
import { findUserById } from '../../modules/users/users-repo';
import { createOpenAPIApp } from '../../openapi/app';
import { apiError, errorResponses } from '../../openapi/responses';

const ListPersonsQuery = z.object({
  isOpen: z.enum(['true', 'false']).optional(),
  userId: Uuid.optional(),
});

const PersonIdParam = z.object({
  id: Uuid,
});

const listPersonsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List persons',
  description:
    'List all persons with optional filters by isOpen status and userId. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    query: ListPersonsQuery,
  },
  responses: {
    200: {
      description: 'List of persons',
      content: {
        'application/json': {
          schema: z.array(AdminPersonDto).openapi('PersonList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const createPersonRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Create person',
  description:
    'Create a new person (character). If userId provided, validates that user exists and has no other open person (rotation rule). Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePersonInput.openapi('CreatePersonInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Person created successfully',
      content: {
        'application/json': {
          schema: AdminPersonDto.openapi('AdminPersonDto'),
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

const getPersonRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['admin'],
  summary: 'Get person',
  description: 'Retrieve person by ID. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: PersonIdParam,
  },
  responses: {
    200: {
      description: 'Person data',
      content: {
        'application/json': {
          schema: AdminPersonDto.openapi('AdminPersonDto'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const updatePersonRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['admin'],
  summary: 'Update person',
  description:
    'Update person fields. Handles special logic for isOpen transitions (open/close person) and userId assignment (rotation). Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: PersonIdParam,
    body: {
      content: {
        'application/json': {
          schema: UpdatePersonInput.openapi('UpdatePersonInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Person updated successfully',
      content: {
        'application/json': {
          schema: AdminPersonDto.openapi('AdminPersonDto'),
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

const getDossierRoute = createRoute({
  method: 'get',
  path: '/:id/dossier',
  tags: ['admin'],
  summary: 'Get person dossier',
  description:
    'Retrieve complete person dossier with all associated data (contracts, ratings, etc.). Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: PersonIdParam,
  },
  responses: {
    200: {
      description: 'Person dossier data',
      content: {
        'application/json': {
          schema: PersonDossierDto.openapi('PersonDossier'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const adminPersonsRoutes = createOpenAPIApp();

adminPersonsRoutes.use('*', requireAuth, requireRole('admin'));

adminPersonsRoutes.openapi(listPersonsRoute, async (c) => {
  const { isOpen: isOpenStr, userId } = c.req.valid('query');

  const isOpen = isOpenStr === 'true' ? true : isOpenStr === 'false' ? false : undefined;

  const rows = await listPersons({
    ...(isOpen !== undefined && { isOpen }),
    ...(userId && { userId }),
  });
  return c.json(
    rows.map((r) => toAdminPersonDto(r)),
    200,
  );
});

adminPersonsRoutes.openapi(createPersonRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { userId, displayName, raceCode, roleCode, age } = c.req.valid('json');

  if (userId) {
    const user = await findUserById(userId);
    if (!user) {
      return apiError(c, 404, { code: 'not_found', message: 'User not found' });
    }

    const existing = await findOpenPersonByUserId(userId);
    if (existing) {
      return apiError(c, 409, {
        code: 'conflict',
        message: 'User already has an open person. Close the existing one first (rotation).',
      });
    }
  }

  const person = await createPerson({
    userId: userId ?? null,
    displayName,
    raceCode,
    roleCode,
    ...(age !== undefined && { age }),
  });
  await writeAudit({
    actorUserId: actor.id,
    action: 'person.create',
    entityType: 'person',
    entityId: person.id,
    payload: { userId: userId ?? null, displayName, raceCode, roleCode, age: age ?? null },
  });
  return c.json(toAdminPersonDto(person), 201);
});

adminPersonsRoutes.openapi(getPersonRoute, async (c) => {
  const { id } = c.req.valid('param');
  const person = await findPersonById(id);
  if (!person) {
    return c.json({ code: 'not_found', message: 'Person not found' } satisfies ApiError, 404);
  }
  return c.json(toAdminPersonDto(person), 200);
});

adminPersonsRoutes.openapi(updatePersonRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');

  if (Object.keys(data).length === 0) {
    return apiError(c, 400, { code: 'validation_error', message: 'No fields to update' });
  }

  const existing = await findPersonById(id);
  if (!existing) {
    return c.json({ code: 'not_found', message: 'Person not found' } satisfies ApiError, 404);
  }

  const { userId, isOpen, ...rest } = data;

  if (userId !== undefined && userId !== null) {
    const user = await findUserById(userId);
    if (!user) {
      return apiError(c, 404, { code: 'not_found', message: 'User not found' });
    }
    // Имя намеренно отличается от импортированного openPerson(): раньше локальная
    // переменная затеняла его и вызов ниже падал ReferenceError.
    const existingOpen = await findOpenPersonByUserId(userId);
    if (existingOpen && existingOpen.id !== id) {
      return apiError(c, 409, {
        code: 'conflict',
        message: 'User already has an open person assigned.',
      });
    }
  }

  if (isOpen === false && existing.isOpen) {
    const closed = await closePerson(id);
    // Между проверкой и обновлением персонажа мог закрыть кто-то ещё.
    if (!closed) {
      return apiError(c, 404, { code: 'not_found', message: 'Person not found' });
    }
    await writeAudit({
      actorUserId: actor.id,
      action: 'person.close',
      entityType: 'person',
      entityId: id,
    });
    return c.json(toAdminPersonDto(closed), 200);
  }

  if (isOpen === true && !existing.isOpen) {
    if (userId) {
      const openExisting = await findOpenPersonByUserId(userId);
      if (openExisting) {
        return apiError(c, 409, {
          code: 'conflict',
          message: 'User already has an open person assigned.',
        });
      }
    }
    const opened = await openPerson(id);
    if (!opened) {
      return c.json({ code: 'not_found', message: 'Person not found' } satisfies ApiError, 404);
    }
    await writeAudit({
      actorUserId: actor.id,
      action: 'person.open',
      entityType: 'person',
      entityId: id,
    });
    if (userId !== undefined) {
      const withUser = await updatePerson(id, { userId });
      if (!withUser) {
        return apiError(c, 404, { code: 'not_found', message: 'Person not found' });
      }
      return c.json(toAdminPersonDto(withUser), 200);
    }
    return c.json(toAdminPersonDto(opened), 200);
  }

  const updated = await updatePerson(id, {
    ...rest,
    ...(userId !== undefined && { userId }),
  });
  if (!updated) {
    return c.json({ code: 'not_found', message: 'Person not found' } satisfies ApiError, 404);
  }

  await writeAudit({
    actorUserId: actor.id,
    action: 'person.update',
    entityType: 'person',
    entityId: id,
    payload: data,
  });

  return c.json(toAdminPersonDto(updated), 200);
});

adminPersonsRoutes.openapi(getDossierRoute, async (c) => {
  const { id } = c.req.valid('param');
  const dossier = await findPersonDossier(id);
  if (!dossier) {
    return c.json({ code: 'not_found', message: 'Person not found' } satisfies ApiError, 404);
  }
  return c.json(dossier, 200);
});
