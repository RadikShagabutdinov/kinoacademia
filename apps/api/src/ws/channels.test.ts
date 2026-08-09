import type { RoleCode } from '@kinoacademia/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../auth/middleware';

vi.mock('../auth/ownership', () => ({
  ownsPerson: vi.fn(),
  ownsCompany: vi.fn(),
}));

vi.mock('../db/client', () => ({ db: {} }));

import * as ownership from '../auth/ownership';
import { canSubscribe, parseChannel } from './channels';

const user = (role: RoleCode, id = 'user-1'): AuthUser => ({ id, role });
const UUID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.mocked(ownership.ownsPerson).mockReset();
  vi.mocked(ownership.ownsCompany).mockReset();
});

describe('parseChannel', () => {
  it('parses static channels', () => {
    expect(parseChannel('contracts:my')).toEqual({ kind: 'contracts:my' });
    expect(parseChannel('ratings:all')).toEqual({ kind: 'ratings:all' });
    expect(parseChannel('oscars')).toEqual({ kind: 'oscars' });
    expect(parseChannel('system')).toEqual({ kind: 'system' });
  });

  it('parses person and company with uuid', () => {
    expect(parseChannel(`person:${UUID}`)).toEqual({ kind: 'person', personId: UUID });
    expect(parseChannel(`company:${UUID}`)).toEqual({ kind: 'company', companyId: UUID });
  });

  it('rejects invalid channels', () => {
    expect(parseChannel('person:not-uuid')).toBeNull();
    expect(parseChannel('unknown')).toBeNull();
    expect(parseChannel('')).toBeNull();
    expect(parseChannel('person:')).toBeNull();
  });
});

describe('canSubscribe', () => {
  it('allows system and contracts:my for any auth user', async () => {
    expect(await canSubscribe(user('emp'), 'system')).toEqual({ ok: true });
    expect(await canSubscribe(user('emp'), 'contracts:my')).toEqual({ ok: true });
  });

  it('rejects ratings:all for emp/head, allows info/admin', async () => {
    expect(await canSubscribe(user('emp'), 'ratings:all')).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(await canSubscribe(user('head'), 'ratings:all')).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(await canSubscribe(user('info'), 'ratings:all')).toEqual({ ok: true });
    expect(await canSubscribe(user('admin'), 'ratings:all')).toEqual({ ok: true });
  });

  it('allows oscars for head/info/admin', async () => {
    expect(await canSubscribe(user('head'), 'oscars')).toEqual({ ok: true });
    expect(await canSubscribe(user('info'), 'oscars')).toEqual({ ok: true });
    expect(await canSubscribe(user('admin'), 'oscars')).toEqual({ ok: true });
    expect(await canSubscribe(user('emp'), 'oscars')).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('person: emp can subscribe to own, not to others', async () => {
    vi.mocked(ownership.ownsPerson).mockResolvedValueOnce(true);
    expect(await canSubscribe(user('emp'), `person:${UUID}`)).toEqual({ ok: true });

    vi.mocked(ownership.ownsPerson).mockResolvedValueOnce(false);
    expect(await canSubscribe(user('emp'), `person:${OTHER}`)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
  });

  it('person: info/admin bypass ownership check', async () => {
    expect(await canSubscribe(user('admin'), `person:${UUID}`)).toEqual({ ok: true });
    expect(ownership.ownsPerson).not.toHaveBeenCalled();
  });

  it('company: head must own, info/admin bypass', async () => {
    vi.mocked(ownership.ownsCompany).mockResolvedValueOnce(false);
    expect(await canSubscribe(user('head'), `company:${UUID}`)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(await canSubscribe(user('info'), `company:${UUID}`)).toEqual({ ok: true });
  });

  it('rejects invalid channel name', async () => {
    expect(await canSubscribe(user('admin'), 'garbage')).toEqual({
      ok: false,
      reason: 'invalid_channel',
    });
  });
});
