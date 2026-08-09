import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthVariables } from './middleware';

type StoredUser = {
  id: string;
  login: string;
  passwordHash: string;
  roleCode: 'emp' | 'head' | 'info' | 'admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StoredSession = {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

const usersById = new Map<string, StoredUser>();
const sessionsById = new Map<string, StoredSession>();
const accessLogEntries: Array<{ userId: string | null; action: string }> = [];

vi.mock('../db/client', () => ({
  db: {} as unknown,
  queryClient: { end: async () => {} },
}));

vi.mock('./users-repo', () => ({
  findUserByLogin: async (login: string) => {
    for (const u of usersById.values()) if (u.login === login) return u;
    return null;
  },
  findUserById: async (id: string) => usersById.get(id) ?? null,
}));

vi.mock('../modules/persons/persons-repo', () => ({
  findOpenPersonByUserId: async () => null,
  toPersonDto: (row: unknown) => row,
}));

vi.mock('./access-log-repo', () => ({
  logAccess: async (userId: string | null, action: string) => {
    accessLogEntries.push({ userId, action });
  },
}));

vi.mock('./sessions', async () => {
  const { signRefreshToken } = await import('./jwt');
  return {
    issueSession: async (_db: unknown, userId: string) => {
      const sessionId = randomUUID();
      const refreshToken = await signRefreshToken(userId, sessionId);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sessionsById.set(sessionId, {
        id: sessionId,
        userId,
        refreshToken,
        expiresAt,
        revokedAt: null,
      });
      return { sessionId, refreshToken, expiresAt };
    },
    findActiveSession: async (_db: unknown, sessionId: string, refreshToken: string) => {
      const s = sessionsById.get(sessionId);
      if (!s || s.revokedAt || s.refreshToken !== refreshToken) return null;
      if (s.expiresAt.getTime() <= Date.now()) return null;
      return s;
    },
    revokeSession: async (_db: unknown, sessionId: string) => {
      const s = sessionsById.get(sessionId);
      if (s && !s.revokedAt) s.revokedAt = new Date();
    },
    rotateSession: async (_db: unknown, sessionId: string, userId: string) => {
      const old = sessionsById.get(sessionId);
      if (old) old.revokedAt = new Date();
      const newId = randomUUID();
      const { signRefreshToken } = await import('./jwt');
      const refreshToken = await signRefreshToken(userId, newId);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sessionsById.set(newId, {
        id: newId,
        userId,
        refreshToken,
        expiresAt,
        revokedAt: null,
      });
      return { sessionId: newId, refreshToken, expiresAt };
    },
  };
});

import { signAccessToken } from './jwt';
import { hashPassword } from './password';

const importApp = async () => (await import('../index')).default;

const seedUser = async (overrides: Partial<StoredUser> = {}): Promise<StoredUser> => {
  const id = overrides.id ?? randomUUID();
  const user: StoredUser = {
    id,
    login: overrides.login ?? 'testuser',
    passwordHash: overrides.passwordHash ?? (await hashPassword('password123')),
    roleCode: overrides.roleCode ?? 'emp',
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
  usersById.set(id, user);
  return user;
};

const parseSetCookies = (res: Response): Record<string, string> => {
  const cookies: Record<string, string> = {};
  for (const header of res.headers.getSetCookie?.() ?? []) {
    const pair = header.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
};

beforeEach(() => {
  usersById.clear();
  sessionsById.clear();
  accessLogEntries.length = 0;
});

describe('POST /api/auth/login', () => {
  it('returns 200 and sets two cookies on success', async () => {
    const app = await importApp();
    const user = await seedUser({ login: 'good' });

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'good', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; login: string };
    expect(body.id).toBe(user.id);
    expect(body.login).toBe('good');

    const cookies = parseSetCookies(res);
    expect(cookies.ka_access).toBeDefined();
    expect(cookies.ka_refresh).toBeDefined();
    expect(accessLogEntries.some((e) => e.action === 'auth.login.success')).toBe(true);
  });

  it('returns 401 on wrong password and logs failure', async () => {
    const app = await importApp();
    await seedUser({ login: 'good' });

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'good', password: 'wrong-pass' }),
    });
    expect(res.status).toBe(401);
    expect(accessLogEntries.some((e) => e.action === 'auth.login.fail')).toBe(true);
  });

  it('returns 400 on invalid payload', async () => {
    const app = await importApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'x', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without access cookie', async () => {
    const app = await importApp();
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 on tampered access token', async () => {
    const app = await importApp();
    const res = await app.request('/api/auth/me', {
      headers: { cookie: 'ka_access=not.a.jwt' },
    });
    expect(res.status).toBe(401);
  });

  it('returns user dto with valid access cookie', async () => {
    const app = await importApp();
    const user = await seedUser();
    const access = await signAccessToken(user.id, user.roleCode);

    const res = await app.request('/api/auth/me', {
      headers: { cookie: `ka_access=${access}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string }; person: unknown };
    expect(body.user.id).toBe(user.id);
    expect(body.person).toBeNull();
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates refresh token and issues new cookies', async () => {
    const app = await importApp();
    await seedUser({ login: 'rotateuser' });

    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'rotateuser', password: 'password123' }),
    });
    const cookies = parseSetCookies(loginRes);
    const refresh = cookies.ka_refresh ?? '';

    const res = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `ka_refresh=${refresh}` },
    });
    expect(res.status).toBe(200);
    const newCookies = parseSetCookies(res);
    expect(newCookies.ka_access).toBeDefined();
    expect(newCookies.ka_refresh).toBeDefined();
    expect(newCookies.ka_refresh).not.toBe(refresh);
  });

  it('rejects refresh after logout', async () => {
    const app = await importApp();
    await seedUser({ login: 'logoutuser' });

    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: 'logoutuser', password: 'password123' }),
    });
    const refresh = parseSetCookies(loginRes).ka_refresh ?? '';

    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `ka_refresh=${refresh}` },
    });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { cookie: `ka_refresh=${refresh}` },
    });
    expect(refreshRes.status).toBe(401);
  });

  it('returns 401 without refresh cookie', async () => {
    const app = await importApp();
    const res = await app.request('/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('blocks non-admin from admin-only route with 403', async () => {
    const { Hono } = await import('hono');
    const { requireAuth, requireRole } = await import('./middleware');
    const subApp = new Hono<{ Variables: AuthVariables }>();
    subApp.get('/admin', requireAuth, requireRole('admin'), (c) => c.json({ ok: true }));

    const empUser = await seedUser({ roleCode: 'emp' });
    const access = await signAccessToken(empUser.id, 'emp');

    const res = await subApp.request('/admin', {
      headers: { cookie: `ka_access=${access}` },
    });
    expect(res.status).toBe(403);
  });

  it('allows admin role through', async () => {
    const { Hono } = await import('hono');
    const { requireAuth, requireRole } = await import('./middleware');
    const subApp = new Hono<{ Variables: AuthVariables }>();
    subApp.get('/admin', requireAuth, requireRole('admin'), (c) => c.json({ ok: true }));

    const adminUser = await seedUser({ roleCode: 'admin' });
    const access = await signAccessToken(adminUser.id, 'admin');

    const res = await subApp.request('/admin', {
      headers: { cookie: `ka_access=${access}` },
    });
    expect(res.status).toBe(200);
  });
});
