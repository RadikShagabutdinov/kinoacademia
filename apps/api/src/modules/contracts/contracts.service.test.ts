import { randomUUID } from 'node:crypto';
import type { ContractKind, ContractSide, ContractStatusCode } from '@kinoacademia/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredContract = {
  id: string;
  kind: ContractKind;
  personId: string;
  companyId: string;
  statusCode: ContractStatusCode;
  startedAt: Date | null;
  endedAt: Date | null;
  breakupInitiatedBy: ContractSide | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredHistory = {
  id: string;
  contractId: string;
  contractKind: ContractKind;
  fromStatusCode: ContractStatusCode | null;
  toStatusCode: ContractStatusCode;
  changedByUserId: string | null;
  comment: string | null;
  changedAt: Date;
};

const contracts = new Map<string, StoredContract>();
const history: StoredHistory[] = [];

/** Статусы уже заключённого контракта — зеркало EFFECTIVE_STATUSES из репозитория. */
const EFFECTIVE: ContractStatusCode[] = ['confirmed', 'breakup_sent', 'breakup_rejected'];

vi.mock('../../db/client', () => {
  const fakeDb = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb(fakeDb),
  };
  return { db: fakeDb, queryClient: { end: async () => {} } };
});

vi.mock('./contracts-repo', () => ({
  findContract: async (_exec: unknown, kind: ContractKind, id: string) => {
    const c = contracts.get(id);
    return c && c.kind === kind ? { ...c } : null;
  },
  findEffectivePermanentByPerson: async (_exec: unknown, personId: string) => {
    for (const c of contracts.values()) {
      if (
        c.kind === 'permanent' &&
        c.personId === personId &&
        c.endedAt === null &&
        EFFECTIVE.includes(c.statusCode)
      )
        return { ...c };
    }
    return null;
  },
  findEffectiveTemporary: async (_exec: unknown, personId: string, companyId: string) => {
    for (const c of contracts.values()) {
      if (
        c.kind === 'temporary' &&
        c.personId === personId &&
        c.companyId === companyId &&
        c.endedAt === null &&
        EFFECTIVE.includes(c.statusCode)
      )
        return { ...c };
    }
    return null;
  },
  findActivePermanentByPersonCompany: async (
    _exec: unknown,
    personId: string,
    companyId: string,
  ) => {
    for (const c of contracts.values()) {
      if (
        c.kind === 'permanent' &&
        c.personId === personId &&
        c.companyId === companyId &&
        c.endedAt === null
      )
        return { ...c };
    }
    return null;
  },
  findActiveTemporary: async (_exec: unknown, personId: string, companyId: string) => {
    for (const c of contracts.values()) {
      if (
        c.kind === 'temporary' &&
        c.personId === personId &&
        c.companyId === companyId &&
        c.endedAt === null
      )
        return { ...c };
    }
    return null;
  },
  insertContract: async (
    _exec: unknown,
    kind: ContractKind,
    data: { personId: string; companyId: string; statusCode: ContractStatusCode },
  ) => {
    const now = new Date();
    const row: StoredContract = {
      id: randomUUID(),
      kind,
      personId: data.personId,
      companyId: data.companyId,
      statusCode: data.statusCode,
      startedAt: null,
      endedAt: null,
      breakupInitiatedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    contracts.set(row.id, row);
    return { ...row };
  },
  updateContractStatus: async (
    _exec: unknown,
    kind: ContractKind,
    id: string,
    data: {
      statusCode: ContractStatusCode;
      startedAt?: Date | null;
      endedAt?: Date | null;
      breakupInitiatedBy?: ContractSide | null;
    },
  ) => {
    const c = contracts.get(id);
    if (!c || c.kind !== kind) return null;
    c.statusCode = data.statusCode;
    if (data.startedAt !== undefined) c.startedAt = data.startedAt;
    if (data.endedAt !== undefined) c.endedAt = data.endedAt;
    if (data.breakupInitiatedBy !== undefined) c.breakupInitiatedBy = data.breakupInitiatedBy;
    c.updatedAt = new Date();
    return { ...c };
  },
  insertHistory: async (
    _exec: unknown,
    data: {
      contractId: string;
      contractKind: ContractKind;
      fromStatusCode: ContractStatusCode | null;
      toStatusCode: ContractStatusCode;
      changedByUserId: string | null;
      comment?: string | null;
    },
  ) => {
    history.push({
      id: randomUUID(),
      contractId: data.contractId,
      contractKind: data.contractKind,
      fromStatusCode: data.fromStatusCode,
      toStatusCode: data.toStatusCode,
      changedByUserId: data.changedByUserId,
      comment: data.comment ?? null,
      changedAt: new Date(),
    });
  },
  listContractsByPerson: async (_exec: unknown, personId: string) =>
    [...contracts.values()].filter((c) => c.personId === personId).map((c) => ({ ...c })),
  listContractsByCompany: async (_exec: unknown, companyId: string) =>
    [...contracts.values()].filter((c) => c.companyId === companyId).map((c) => ({ ...c })),
}));

import * as service from './contracts.service';
import { ContractError } from './errors';

const seedContract = (overrides: Partial<StoredContract>): StoredContract => {
  const now = new Date();
  const row: StoredContract = {
    id: overrides.id ?? randomUUID(),
    kind: overrides.kind ?? 'permanent',
    personId: overrides.personId ?? randomUUID(),
    companyId: overrides.companyId ?? randomUUID(),
    statusCode: overrides.statusCode ?? 'draft',
    startedAt: overrides.startedAt ?? null,
    endedAt: overrides.endedAt ?? null,
    breakupInitiatedBy: overrides.breakupInitiatedBy ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  contracts.set(row.id, row);
  return row;
};

const ACTOR = randomUUID();

beforeEach(() => {
  contracts.clear();
  history.length = 0;
  service.setPenaltyHook(null);
});

describe('createDraft', () => {
  it('creates draft and writes initial history record', async () => {
    const personId = randomUUID();
    const companyId = randomUUID();
    const created = await service.createDraft({
      kind: 'permanent',
      personId,
      companyId,
      actorUserId: ACTOR,
    });
    expect(created.statusCode).toBe('draft');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      contractId: created.id,
      fromStatusCode: null,
      toStatusCode: 'draft',
      changedByUserId: ACTOR,
    });
  });

  it('rejects duplicate active permanent for same person+company', async () => {
    const personId = randomUUID();
    const companyId = randomUUID();
    seedContract({ kind: 'permanent', personId, companyId, statusCode: 'confirmed' });
    await expect(
      service.createDraft({ kind: 'permanent', personId, companyId, actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'permanent_exists_same_company' });
  });

  it('rejects duplicate active temporary for same person+company', async () => {
    const personId = randomUUID();
    const companyId = randomUUID();
    seedContract({ kind: 'temporary', personId, companyId, statusCode: 'confirmed' });
    await expect(
      service.createDraft({ kind: 'temporary', personId, companyId, actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'duplicate_temporary' });
  });
});

describe('state transitions', () => {
  it('submit: draft -> sent', async () => {
    const c = seedContract({ statusCode: 'draft' });
    const updated = await service.submit({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('sent');
    expect(history.at(-1)).toMatchObject({ fromStatusCode: 'draft', toStatusCode: 'sent' });
  });

  it('reject: sent -> rejected (sets endedAt)', async () => {
    const c = seedContract({ statusCode: 'sent' });
    const updated = await service.reject({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('rejected');
    expect(updated.endedAt).toBeInstanceOf(Date);
  });

  it('breakByCompany: confirmed -> broken_company', async () => {
    const c = seedContract({ statusCode: 'confirmed' });
    const updated = await service.breakByCompany({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('broken_company');
    expect(updated.endedAt).toBeInstanceOf(Date);
  });

  it('requestEnd: confirmed -> breakup_sent', async () => {
    const c = seedContract({ statusCode: 'confirmed' });
    const updated = await service.requestEnd({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('breakup_sent');
    expect(updated.endedAt).toBeNull();
  });

  it('confirmEnd: breakup_sent -> breakup_confirmed (sets endedAt)', async () => {
    const c = seedContract({ statusCode: 'breakup_sent' });
    const updated = await service.confirmEnd({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('breakup_confirmed');
    expect(updated.endedAt).toBeInstanceOf(Date);
  });

  it('rejectEnd: breakup_sent -> breakup_rejected', async () => {
    const c = seedContract({ statusCode: 'breakup_sent' });
    const updated = await service.rejectEnd({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('breakup_rejected');
    expect(updated.endedAt).toBeNull();
  });

  it('requestEnd: запоминает инициатора расторжения', async () => {
    const c = seedContract({ statusCode: 'confirmed' });
    const updated = await service.requestEnd({
      kind: c.kind,
      id: c.id,
      actorUserId: ACTOR,
      side: 'person',
    });
    expect(updated.breakupInitiatedBy).toBe('person');
  });

  it('confirmEnd: инициатор не может подтвердить собственный запрос', async () => {
    const c = seedContract({ statusCode: 'breakup_sent', breakupInitiatedBy: 'person' });
    await expect(
      service.confirmEnd({ kind: c.kind, id: c.id, actorUserId: ACTOR, side: 'person' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('confirmEnd: противоположная сторона подтверждает запрос', async () => {
    const c = seedContract({ statusCode: 'breakup_sent', breakupInitiatedBy: 'person' });
    const updated = await service.confirmEnd({
      kind: c.kind,
      id: c.id,
      actorUserId: ACTOR,
      side: 'company',
    });
    expect(updated.statusCode).toBe('breakup_confirmed');
  });

  it('breakup_rejected не является тупиком: контракт можно разорвать снова', async () => {
    const c = seedContract({ statusCode: 'breakup_rejected' });
    const updated = await service.breakByCompany({ kind: c.kind, id: c.id, actorUserId: ACTOR });
    expect(updated.statusCode).toBe('broken_company');
  });

  it('rejects invalid transitions with INVALID_TRANSITION', async () => {
    const c = seedContract({ statusCode: 'draft' });
    await expect(
      service.confirm({ kind: c.kind, id: c.id, actorUserId: ACTOR }),
    ).rejects.toMatchObject({ code: 'invalid_transition' });
  });

  it('throws contract_not_found for missing contract', async () => {
    await expect(
      service.submit({ kind: 'permanent', id: randomUUID(), actorUserId: ACTOR }),
    ).rejects.toBeInstanceOf(ContractError);
  });
});

describe('confirm permanent side-effects', () => {
  it('auto-breaks old permanent of the same person and triggers penalty hook', async () => {
    const personId = randomUUID();
    const oldPermanent = seedContract({
      kind: 'permanent',
      personId,
      statusCode: 'confirmed',
      startedAt: new Date(),
    });
    const newPermanent = seedContract({
      kind: 'permanent',
      personId,
      statusCode: 'sent',
    });

    const penaltyCalls: Array<{ reason: string; personId: string }> = [];
    service.setPenaltyHook(async (payload) => {
      penaltyCalls.push({
        reason: payload.reason,
        personId: payload.personId,
      });
    });

    const updated = await service.confirm({
      kind: 'permanent',
      id: newPermanent.id,
      actorUserId: ACTOR,
    });

    expect(updated.statusCode).toBe('confirmed');
    expect(updated.startedAt).toBeInstanceOf(Date);

    const oldUpdated = contracts.get(oldPermanent.id);
    expect(oldUpdated?.statusCode).toBe('broken_person');
    expect(oldUpdated?.endedAt).toBeInstanceOf(Date);

    expect(penaltyCalls).toHaveLength(1);
    expect(penaltyCalls[0]).toMatchObject({
      reason: 'auto_break_old_permanent',
      personId,
    });
  });

  it('игнорирует непринятое предложение постоянного от другой компании', async () => {
    const personId = randomUUID();
    // Забытый черновик от компании Б не должен блокировать подтверждение
    // предложения компании А: заключённым контрактом он не является.
    const staleDraft = seedContract({ kind: 'permanent', personId, statusCode: 'draft' });
    const offer = seedContract({ kind: 'permanent', personId, statusCode: 'sent' });

    const updated = await service.confirm({
      kind: 'permanent',
      id: offer.id,
      actorUserId: ACTOR,
    });

    expect(updated.statusCode).toBe('confirmed');
    expect(contracts.get(staleDraft.id)?.statusCode).toBe('draft');
  });

  it('auto-breaks active temporary with the same company on permanent confirm', async () => {
    const personId = randomUUID();
    const companyId = randomUUID();
    const temp = seedContract({
      kind: 'temporary',
      personId,
      companyId,
      statusCode: 'confirmed',
    });
    const perm = seedContract({
      kind: 'permanent',
      personId,
      companyId,
      statusCode: 'sent',
    });

    await service.confirm({ kind: 'permanent', id: perm.id, actorUserId: ACTOR });

    const tempUpdated = contracts.get(temp.id);
    // Разрыв по обоюдному согласию, а не односторонний со стороны компании.
    expect(tempUpdated?.statusCode).toBe('breakup_confirmed');
    expect(tempUpdated?.endedAt).toBeInstanceOf(Date);
  });
});

describe('breakByPerson penalty', () => {
  it('triggers penalty hook for permanent contract', async () => {
    const c = seedContract({ kind: 'permanent', statusCode: 'confirmed' });
    const calls: string[] = [];
    service.setPenaltyHook(async (p) => {
      calls.push(p.reason);
    });
    const updated = await service.breakByPerson({
      kind: 'permanent',
      id: c.id,
      actorUserId: ACTOR,
    });
    expect(updated.statusCode).toBe('broken_person');
    expect(calls).toEqual(['unilateral_break_by_person']);
  });

  it('does not trigger penalty for temporary contract', async () => {
    const c = seedContract({ kind: 'temporary', statusCode: 'confirmed' });
    const calls: string[] = [];
    service.setPenaltyHook(async (p) => {
      calls.push(p.reason);
    });
    const updated = await service.breakByPerson({
      kind: 'temporary',
      id: c.id,
      actorUserId: ACTOR,
    });
    expect(updated.statusCode).toBe('broken_person');
    expect(calls).toEqual([]);
  });
});
