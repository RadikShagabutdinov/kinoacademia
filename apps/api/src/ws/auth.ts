import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { ACCESS_COOKIE } from '../auth/cookies';
import { verifyAccessToken } from '../auth/jwt';
import type { AuthUser } from '../auth/middleware';

export const authenticateHandshake = async (c: Context): Promise<AuthUser | null> => {
  const token = getCookie(c, ACCESS_COOKIE);
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
};
