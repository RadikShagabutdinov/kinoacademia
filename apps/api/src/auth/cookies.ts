import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';

type CookieOptions = Parameters<typeof setCookie>[3];
import { env, isProduction } from '../env';
import { accessTokenTtlSeconds, refreshTokenTtlSeconds } from './jwt';

export const ACCESS_COOKIE = 'ka_access';
export const REFRESH_COOKIE = 'ka_refresh';

const buildOptions = (extra: CookieOptions): CookieOptions => {
  const base: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict',
    path: '/',
    ...extra,
  };
  if (env.COOKIE_DOMAIN) base.domain = env.COOKIE_DOMAIN;
  return base;
};

export const setAuthCookies = (c: Context, accessToken: string, refreshToken: string): void => {
  setCookie(c, ACCESS_COOKIE, accessToken, buildOptions({ maxAge: accessTokenTtlSeconds }));
  setCookie(
    c,
    REFRESH_COOKIE,
    refreshToken,
    buildOptions({ maxAge: refreshTokenTtlSeconds, path: '/api/auth' }),
  );
};

export const clearAuthCookies = (c: Context): void => {
  deleteCookie(c, ACCESS_COOKIE, buildOptions({}));
  deleteCookie(c, REFRESH_COOKIE, buildOptions({ path: '/api/auth' }));
};
