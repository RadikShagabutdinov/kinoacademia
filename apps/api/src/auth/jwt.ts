import type { RoleCode } from '@kinoacademia/shared';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../env';

const ACCESS_TTL_SECONDS = 60 * 60;
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ISSUER = 'kinoacademia-api';
const ACCESS_AUDIENCE = 'kinoacademia-access';
const REFRESH_AUDIENCE = 'kinoacademia-refresh';

export type AccessTokenPayload = {
  sub: string;
  role: RoleCode;
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
};

export const accessTokenTtlSeconds = ACCESS_TTL_SECONDS;
export const refreshTokenTtlSeconds = REFRESH_TTL_SECONDS;

export const signAccessToken = async (userId: string, role: RoleCode): Promise<string> =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(accessSecret);

export const signRefreshToken = async (userId: string, sessionId: string): Promise<string> =>
  new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(REFRESH_AUDIENCE)
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(refreshSecret);

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload> => {
  const { payload } = await jwtVerify(token, accessSecret, {
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  });
  if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
    throw new Error('Invalid access token payload');
  }
  return { sub: payload.sub, role: payload.role as RoleCode };
};

export const verifyRefreshToken = async (token: string): Promise<RefreshTokenPayload> => {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
  });
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Invalid refresh token payload');
  }
  return { sub: payload.sub, sid: payload.sid };
};
