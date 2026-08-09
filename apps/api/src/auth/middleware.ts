import type { ApiError, RoleCode } from '@kinoacademia/shared';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ACCESS_COOKIE } from './cookies';
import { verifyAccessToken } from './jwt';

export type AuthUser = {
  id: string;
  role: RoleCode;
};

export type AuthVariables = {
  user: AuthUser;
};

const unauthorized = (c: Context, message = 'Unauthorized') => {
  const body: ApiError = { code: 'unauthorized', message };
  return c.json(body, 401);
};

const forbidden = (c: Context, message = 'Forbidden') => {
  const body: ApiError = { code: 'forbidden', message };
  return c.json(body, 403);
};

export const requireAuth: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, ACCESS_COOKIE);
  if (!token) return unauthorized(c, 'Missing access token');

  try {
    const payload = await verifyAccessToken(token);
    c.set('user', { id: payload.sub, role: payload.role });
  } catch {
    return unauthorized(c, 'Invalid or expired access token');
  }

  await next();
  return;
};

export const requireRole = (
  ...roles: RoleCode[]
): MiddlewareHandler<{ Variables: AuthVariables }> => {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) return unauthorized(c);
    if (!roles.includes(user.role)) return forbidden(c, 'Insufficient role');
    await next();
    return;
  };
};
