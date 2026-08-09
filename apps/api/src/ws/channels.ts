import type { RoleCode } from '@kinoacademia/shared';
import type { AuthUser } from '../auth/middleware';
import { ownsCompany, ownsPerson } from '../auth/ownership';
import { db } from '../db/client';

export type ParsedChannel =
  | { kind: 'person'; personId: string }
  | { kind: 'company'; companyId: string }
  | { kind: 'contracts:my' }
  | { kind: 'ratings:all' }
  | { kind: 'oscars' }
  | { kind: 'system' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseChannel = (channel: string): ParsedChannel | null => {
  if (channel === 'contracts:my') return { kind: 'contracts:my' };
  if (channel === 'ratings:all') return { kind: 'ratings:all' };
  if (channel === 'oscars') return { kind: 'oscars' };
  if (channel === 'system') return { kind: 'system' };

  const idx = channel.indexOf(':');
  if (idx <= 0) return null;
  const prefix = channel.slice(0, idx);
  const id = channel.slice(idx + 1);
  if (!UUID_RE.test(id)) return null;
  if (prefix === 'person') return { kind: 'person', personId: id };
  if (prefix === 'company') return { kind: 'company', companyId: id };
  return null;
};

const isInfoOrAdmin = (role: RoleCode): boolean => role === 'info' || role === 'admin';

export type CanSubscribeResult = { ok: true } | { ok: false; reason: string };

export const canSubscribe = async (
  user: AuthUser,
  channel: string,
): Promise<CanSubscribeResult> => {
  const parsed = parseChannel(channel);
  if (!parsed) return { ok: false, reason: 'invalid_channel' };

  switch (parsed.kind) {
    case 'system':
    case 'contracts:my':
      return { ok: true };
    case 'ratings:all':
      return isInfoOrAdmin(user.role) ? { ok: true } : { ok: false, reason: 'forbidden' };
    case 'oscars':
      return user.role === 'head' || isInfoOrAdmin(user.role)
        ? { ok: true }
        : { ok: false, reason: 'forbidden' };
    case 'person': {
      if (isInfoOrAdmin(user.role)) return { ok: true };
      const owns = await ownsPerson(db, user.id, parsed.personId);
      return owns ? { ok: true } : { ok: false, reason: 'forbidden' };
    }
    case 'company': {
      if (isInfoOrAdmin(user.role)) return { ok: true };
      const owns = await ownsCompany(db, user.id, parsed.companyId);
      return owns ? { ok: true } : { ok: false, reason: 'forbidden' };
    }
  }
};

export const personChannel = (personId: string): string => `person:${personId}`;
export const companyChannel = (companyId: string): string => `company:${companyId}`;
