import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt';

describe('jwt', () => {
  it('signs and verifies access token', async () => {
    const token = await signAccessToken('user-1', 'admin');
    const payload = await verifyAccessToken(token);
    expect(payload).toEqual({ sub: 'user-1', role: 'admin' });
  });

  it('signs and verifies refresh token', async () => {
    const token = await signRefreshToken('user-1', 'session-1');
    const payload = await verifyRefreshToken(token);
    expect(payload).toEqual({ sub: 'user-1', sid: 'session-1' });
  });

  it('rejects access token used as refresh', async () => {
    const token = await signAccessToken('user-1', 'emp');
    await expect(verifyRefreshToken(token)).rejects.toBeDefined();
  });

  it('rejects expired token', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const expired = await new SignJWT({ role: 'emp' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setIssuer('kinoacademia-api')
      .setAudience('kinoacademia-access')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);
    await expect(verifyAccessToken(expired)).rejects.toBeDefined();
  });
});
