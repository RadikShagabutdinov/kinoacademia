import { describe, expect, it, vi } from 'vitest';

vi.mock('hono/cookie', () => ({
  getCookie: vi.fn(),
}));

vi.mock('../auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}));

import { getCookie } from 'hono/cookie';
import { verifyAccessToken } from '../auth/jwt';
import { authenticateHandshake } from './auth';

describe('authenticateHandshake', () => {
  it('returns null without cookie', async () => {
    vi.mocked(getCookie).mockReturnValueOnce(undefined);
    const user = await authenticateHandshake({} as never);
    expect(user).toBeNull();
  });

  it('returns null on invalid jwt', async () => {
    vi.mocked(getCookie).mockReturnValueOnce('bad');
    vi.mocked(verifyAccessToken).mockRejectedValueOnce(new Error('bad'));
    const user = await authenticateHandshake({} as never);
    expect(user).toBeNull();
  });

  it('returns user on valid jwt', async () => {
    vi.mocked(getCookie).mockReturnValueOnce('good');
    vi.mocked(verifyAccessToken).mockResolvedValueOnce({ sub: 'u-1', role: 'admin' });
    const user = await authenticateHandshake({} as never);
    expect(user).toEqual({ id: 'u-1', role: 'admin' });
  });
});
