import { z } from '@hono/zod-openapi';

export const ROLES = ['emp', 'head', 'info', 'admin'] as const;

export const RoleCode = z.enum(ROLES);
export type RoleCode = z.infer<typeof RoleCode>;

export const ROLE_LABELS: Record<RoleCode, string> = {
  emp: 'Игрок',
  head: 'Руководитель компании',
  info: 'Менеджер информации',
  admin: 'Администратор',
};
