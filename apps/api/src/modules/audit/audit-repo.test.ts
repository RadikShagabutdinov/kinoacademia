import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogRow } from '../../db/schema';

type CapturedInsert = {
  table: unknown;
  values: Record<string, unknown>;
};

const inserts: CapturedInsert[] = [];
const stored: AuditLogRow[] = [];

const makeRow = (values: Record<string, unknown>): AuditLogRow => ({
  id: `audit-${stored.length + 1}`,
  actorUserId: (values.actorUserId as string | null) ?? null,
  action: values.action as string,
  entityType: values.entityType as string,
  entityId: (values.entityId as string | null) ?? null,
  payload: (values.payload as Record<string, unknown> | null) ?? null,
  createdAt: new Date('2026-06-03T20:00:00Z'),
});

vi.mock('../../db/client', () => {
  const fakeDb = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          inserts.push({ table, values });
          const row = makeRow(values);
          stored.push(row);
          return [row];
        },
      }),
    }),
    select: () => ({
      from: () => {
        let _filters: unknown = undefined;
        const chain = {
          where: (f: unknown) => {
            _filters = f;
            return chain;
          },
          orderBy: () => chain,
          limit: async (_n: number) => stored.slice(0, _n),
        };
        return chain;
      },
    }),
  };
  return { db: fakeDb };
});

import { listAudit, writeAudit } from './audit-repo';

beforeEach(() => {
  inserts.length = 0;
  stored.length = 0;
});

describe('writeAudit', () => {
  it('сохраняет запись с указанными полями', async () => {
    const row = await writeAudit({
      actorUserId: 'u1',
      action: 'user.create',
      entityType: 'user',
      entityId: 'e1',
      payload: { foo: 'bar' },
    });

    expect(row.action).toBe('user.create');
    expect(row.entityType).toBe('user');
    expect(row.entityId).toBe('e1');
    expect(row.payload).toEqual({ foo: 'bar' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.values.action).toBe('user.create');
  });

  it('подставляет null для entityId и payload, если они не заданы', async () => {
    const row = await writeAudit({
      actorUserId: null,
      action: 'randomizer.cancel',
      entityType: 'randomizer',
    });

    expect(row.entityId).toBeNull();
    expect(row.payload).toBeNull();
  });
});

describe('listAudit', () => {
  it('возвращает записи через select', async () => {
    await writeAudit({
      actorUserId: 'u1',
      action: 'transaction.manual',
      entityType: 'person',
      entityId: 'p1',
    });

    const rows = await listAudit({ entityType: 'person', entityId: 'p1', limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe('person');
  });
});
