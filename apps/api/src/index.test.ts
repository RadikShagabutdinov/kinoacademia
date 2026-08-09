import { LoginInput, SHARED_VERSION } from '@kinoacademia/shared';
import { describe, expect, it } from 'vitest';
import app from './index';

describe('API smoke test', () => {
  it('GET /health returns 200', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('imports schemas from @kinoacademia/shared', () => {
    expect(SHARED_VERSION).toBe('0.1.0');
    expect(LoginInput.safeParse({ login: 'admin', password: '12345678' }).success).toBe(true);
  });
});
