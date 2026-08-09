import type { AuditAction, AuditEntityType } from '@kinoacademia/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { type AuditLogRow, auditLog } from '../../db/schema';

export type { AuditAction, AuditEntityType };

export type WriteAuditInput = {
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
};

export const writeAudit = async (input: WriteAuditInput): Promise<AuditLogRow> => {
  const [row] = await db
    .insert(auditLog)
    .values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      payload: (input.payload ?? null) as never,
    })
    .returning();
  if (!row) throw new Error('Failed to write audit log');
  return row;
};

export type ListAuditQuery = {
  entityType?: AuditEntityType;
  entityId?: string;
  actorUserId?: string;
  limit?: number;
};

export const listAudit = async (query: ListAuditQuery = {}): Promise<AuditLogRow[]> => {
  const filters = [
    query.entityType ? eq(auditLog.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLog.entityId, query.entityId) : undefined,
    query.actorUserId ? eq(auditLog.actorUserId, query.actorUserId) : undefined,
  ].filter((x): x is NonNullable<typeof x> => x !== undefined);

  const limit = query.limit ?? 100;
  if (filters.length === 0) {
    return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
  }
  return db
    .select()
    .from(auditLog)
    .where(filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
};
