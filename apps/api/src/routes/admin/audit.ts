import { createRoute, z } from '@hono/zod-openapi';
import { AuditLogEntryDto, AuditLogQuery } from '@kinoacademia/shared';
import { requireAuth, requireRole } from '../../auth/middleware';
import type { AuditLogRow } from '../../db/schema';
import { listAudit } from '../../modules/audit/audit-repo';
import { createOpenAPIApp } from '../../openapi/app';
import { errorResponses } from '../../openapi/responses';

const toAuditDto = (row: AuditLogRow) =>
  AuditLogEntryDto.parse({
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payload as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
  });

const listAuditRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List audit log entries',
  description:
    'List recent audit log entries. Filter by entityType/entityId/actorUserId. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    query: AuditLogQuery,
  },
  responses: {
    200: {
      description: 'Audit log entries',
      content: {
        'application/json': {
          schema: z.array(AuditLogEntryDto).openapi('AuditLogList'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

export const adminAuditRoutes = createOpenAPIApp();
adminAuditRoutes.use('*', requireAuth, requireRole('admin'));

adminAuditRoutes.openapi(listAuditRoute, async (c) => {
  const query = c.req.valid('query');
  const rows = await listAudit({
    ...(query.entityType && { entityType: query.entityType }),
    ...(query.entityId && { entityId: query.entityId }),
    ...(query.actorUserId && { actorUserId: query.actorUserId }),
    ...(query.limit !== undefined && { limit: query.limit }),
  });
  return c.json(rows.map(toAuditDto), 200);
});
