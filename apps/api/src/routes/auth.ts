import { createRoute, z } from '@hono/zod-openapi';
import { ChangePasswordInput, LoginInput, MeDto, UserDto } from '@kinoacademia/shared';
import type { Context } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { getCookie } from 'hono/cookie';
import { logAccess } from '../auth/access-log-repo';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../auth/cookies';
import { signAccessToken, verifyRefreshToken } from '../auth/jwt';
import { type AuthVariables, requireAuth } from '../auth/middleware';
import { hashPassword, verifyPassword } from '../auth/password';
import { findActiveSession, issueSession, revokeSession, rotateSession } from '../auth/sessions';
import { type UserRow, findUserById, findUserByLogin } from '../auth/users-repo';
import { db } from '../db/client';
import { findOpenPersonByUserId, toPersonDto } from '../modules/persons/persons-repo';
import { getPersonRating } from '../modules/ratings/ratings.service';
import { updateUser } from '../modules/users/users-repo';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';

type AuthEnv = { Variables: AuthVariables };

const clientIp = (c: Context): string =>
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'unknown';

const toUserDto = (user: UserRow): UserDto => ({
  id: user.id,
  login: user.login,
  roleCode: user.roleCode,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

const loginLimiter = rateLimiter<AuthEnv>({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => clientIp(c),
  handler: (c) => apiError(c, 429, { code: 'rate_limited', message: 'Too many login attempts' }),
});

const OkResponse = z.object({ ok: z.literal(true) });

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['auth'],
  summary: 'Login user',
  description:
    'Authenticate user with login and password. Returns user data and sets HttpOnly cookies (ka_access, ka_refresh) for session management. Rate-limited to 5 attempts per minute per IP.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginInput.openapi('LoginInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User authenticated successfully',
      content: {
        'application/json': {
          schema: UserDto.openapi('UserDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: z
            .object({
              code: z.literal('rate_limited'),
              message: z.string(),
            })
            .openapi('RateLimitError'),
        },
      },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['auth'],
  summary: 'Refresh access token',
  description:
    'Rotate refresh token and issue new access token. Requires valid ka_refresh cookie. Returns new tokens via HttpOnly cookies.',
  responses: {
    200: {
      description: 'Tokens refreshed successfully',
      content: {
        'application/json': {
          schema: OkResponse.openapi('OkResponse'),
        },
      },
    },
    401: errorResponses[401],
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['auth'],
  summary: 'Logout user',
  description:
    'Revoke active session and clear authentication cookies. Works even if session is already invalid.',
  responses: {
    200: {
      description: 'User logged out successfully',
      content: {
        'application/json': {
          schema: OkResponse.openapi('OkResponse'),
        },
      },
    },
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['auth'],
  summary: 'Get current user',
  description: 'Retrieve authenticated user profile. Requires valid ka_access cookie.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'Current user data',
      content: {
        'application/json': {
          schema: MeDto.openapi('MeDto'),
        },
      },
    },
    401: errorResponses[401],
  },
});

const changePasswordRoute = createRoute({
  method: 'post',
  path: '/change-password',
  tags: ['auth'],
  summary: 'Change password',
  description:
    'Change password for the authenticated user. Clears mustChangePassword flag on success.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChangePasswordInput.openapi('ChangePasswordInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password changed successfully',
      content: {
        'application/json': {
          schema: OkResponse.openapi('OkResponse'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
  },
});

export const authRoutes = createOpenAPIApp();

authRoutes.use('/login', loginLimiter);

authRoutes.openapi(loginRoute, async (c) => {
  const { login, password } = c.req.valid('json');
  const ip = clientIp(c);
  const userAgent = c.req.header('user-agent') ?? null;

  const user = await findUserByLogin(login);
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || !passwordOk) {
    await logAccess(user?.id ?? null, 'auth.login.fail', { login, ip });
    return apiError(c, 401, { code: 'unauthorized', message: 'Invalid login or password' });
  }

  // Деактивированный администратором аккаунт не должен входить, даже зная пароль.
  if (!user.isActive) {
    await logAccess(user.id, 'auth.login.fail', { login, ip, reason: 'inactive' });
    return apiError(c, 403, { code: 'forbidden', message: 'Account is deactivated' });
  }

  const { refreshToken } = await issueSession(db, user.id, { ip, userAgent });
  const accessToken = await signAccessToken(user.id, user.roleCode);
  setAuthCookies(c, accessToken, refreshToken);

  await logAccess(user.id, 'auth.login.success', { ip });

  return c.json(toUserDto(user), 200);
});

authRoutes.openapi(refreshRoute, async (c) => {
  const token = getCookie(c, REFRESH_COOKIE);
  if (!token) {
    return apiError(c, 401, { code: 'unauthorized', message: 'Missing refresh token' });
  }

  let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    clearAuthCookies(c);
    return apiError(c, 401, { code: 'unauthorized', message: 'Invalid refresh token' });
  }

  const session = await findActiveSession(db, payload.sid, token);
  if (!session) {
    clearAuthCookies(c);
    return apiError(c, 401, { code: 'unauthorized', message: 'Session not found or revoked' });
  }

  const user = await findUserById(payload.sub);
  if (!user || !user.isActive) {
    clearAuthCookies(c);
    return apiError(c, 401, { code: 'unauthorized', message: 'User not found or deactivated' });
  }

  const ip = clientIp(c);
  const userAgent = c.req.header('user-agent') ?? null;
  const { refreshToken } = await rotateSession(db, payload.sid, payload.sub, { ip, userAgent });
  const accessToken = await signAccessToken(user.id, user.roleCode);
  setAuthCookies(c, accessToken, refreshToken);

  return c.json({ ok: true as const }, 200);
});

authRoutes.openapi(logoutRoute, async (c) => {
  const token = getCookie(c, REFRESH_COOKIE);
  if (token) {
    try {
      const payload = await verifyRefreshToken(token);
      await revokeSession(db, payload.sid);
    } catch {}
  }
  clearAuthCookies(c);
  return c.json({ ok: true as const }, 200);
});

authRoutes.use('/me', requireAuth);

authRoutes.openapi(meRoute, async (c) => {
  const user = c.get('user');
  const row = await findUserById(user.id);
  if (!row) {
    return apiError(c, 401, { code: 'unauthorized', message: 'User not found' });
  }
  const person = await findOpenPersonByUserId(row.id);
  if (!person) {
    return c.json({ user: toUserDto(row), person: null }, 200);
  }
  // Статус Звезды нужен шапке приложения, поэтому считаем его здесь же.
  const { isStar } = await getPersonRating(person.id);
  return c.json({ user: toUserDto(row), person: toPersonDto(person, isStar) }, 200);
});

authRoutes.use('/change-password', requireAuth);

authRoutes.openapi(changePasswordRoute, async (c) => {
  const authUser = c.get('user');
  const { currentPassword, newPassword } = c.req.valid('json');

  const row = await findUserById(authUser.id);
  if (!row) {
    return apiError(c, 401, { code: 'unauthorized', message: 'User not found' });
  }

  const currentOk = await verifyPassword(row.passwordHash, currentPassword);
  if (!currentOk) {
    return apiError(c, 401, { code: 'unauthorized', message: 'Current password is incorrect' });
  }

  if (currentPassword === newPassword) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'New password must differ from current password',
    });
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUser(row.id, { passwordHash, mustChangePassword: false });
  await logAccess(row.id, 'auth.password.change', { ip: clientIp(c) });

  return c.json({ ok: true as const }, 200);
});
