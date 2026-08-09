import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password')).toBe(false);
  });

  it('returns false on malformed hash without throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});
