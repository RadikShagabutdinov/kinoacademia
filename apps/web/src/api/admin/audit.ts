import { api } from '@/api/client';
import type { AuditEntityType, AuditLogEntryDto } from '@kinoacademia/shared';

export type AuditLogFilter = {
  entityType?: AuditEntityType;
  entityId?: string;
  actorUserId?: string;
  limit?: number;
};

export const listAuditLog = (filter: AuditLogFilter = {}): Promise<AuditLogEntryDto[]> => {
  const params = new URLSearchParams();
  if (filter.entityType) params.set('entityType', filter.entityType);
  if (filter.entityId) params.set('entityId', filter.entityId);
  if (filter.actorUserId) params.set('actorUserId', filter.actorUserId);
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  const qs = params.toString();
  return api.get<AuditLogEntryDto[]>(`/admin/audit${qs ? `?${qs}` : ''}`);
};
