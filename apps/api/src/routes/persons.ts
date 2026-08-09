import { createRoute, z } from '@hono/zod-openapi';
import { PersonDto } from '@kinoacademia/shared';
import { requireAuth } from '../auth/middleware';
import { listPersons, toPersonDto } from '../modules/persons/persons-repo';
import { createOpenAPIApp } from '../openapi/app';
import { errorResponses } from '../openapi/responses';

const listOpenPersonsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['persons'],
  summary: 'List open persons',
  description:
    'Lightweight directory of currently open persons. Available to any authenticated user. Used e.g. as a recipient picker for the admiration mechanic.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'List of open persons',
      content: {
        'application/json': {
          schema: z.array(PersonDto).openapi('OpenPersonList'),
        },
      },
    },
    401: errorResponses[401],
  },
});

export const personsRoutes = createOpenAPIApp();

personsRoutes.use('*', requireAuth);

personsRoutes.openapi(listOpenPersonsRoute, async (c) => {
  const rows = await listPersons({ isOpen: true });
  return c.json(
    rows.map((r) => toPersonDto(r)),
    200,
  );
});
