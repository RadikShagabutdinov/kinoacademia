import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./channels', () => ({
  canSubscribe: vi.fn().mockResolvedValue({ ok: true }),
  personChannel: (id: string) => `person:${id}`,
  companyChannel: (id: string) => `company:${id}`,
}));

vi.mock('../modules/persons/persons-repo', () => ({
  findPersonById: vi.fn(),
}));

import { contractsEmitter } from '../modules/contracts/events';
import * as personsRepo from '../modules/persons/persons-repo';
import { ratingsEmitter } from '../modules/ratings/events';
import { _resetForTests, wireWsBroadcasts } from './broadcasts';
import * as hub from './hub';

beforeEach(() => {
  hub._internal.reset();
  vi.mocked(personsRepo.findPersonById).mockReset();
  wireWsBroadcasts();
  _resetForTests();
});

const fakeWs = () => ({ send: vi.fn(), close: vi.fn() });

describe('wireWsBroadcasts', () => {
  it('rating.updated person → person:{id} and ratings:all subscribers', async () => {
    const wsPerson = fakeWs();
    const wsAll = fakeWs();
    const cPerson = hub.register(wsPerson as never, { id: 'u-a', role: 'admin' });
    const cAll = hub.register(wsAll as never, { id: 'u-b', role: 'admin' });
    await hub.subscribe(cPerson.id, 'person:p-1');
    await hub.subscribe(cAll.id, 'ratings:all');

    ratingsEmitter.emit('rating.updated', { kind: 'person', personId: 'p-1' });

    await new Promise((r) => setImmediate(r));
    expect(wsPerson.send).toHaveBeenCalledTimes(1);
    expect(wsAll.send).toHaveBeenCalledTimes(1);
  });

  it('contract.updated → company channel + contracts:my for owner', async () => {
    vi.mocked(personsRepo.findPersonById).mockResolvedValueOnce({
      id: 'p-1',
      userId: 'u-owner',
      displayName: 'x',
      raceCode: 'homo',
      roleCode: 'emp',
      age: null,
      isOpen: true,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const wsCompany = fakeWs();
    const wsOwner = fakeWs();
    const wsOther = fakeWs();
    const cCompany = hub.register(wsCompany as never, { id: 'u-c', role: 'admin' });
    const cOwner = hub.register(wsOwner as never, { id: 'u-owner', role: 'emp' });
    const cOther = hub.register(wsOther as never, { id: 'u-other', role: 'emp' });
    await hub.subscribe(cCompany.id, 'company:co-1');
    await hub.subscribe(cOwner.id, 'contracts:my');
    await hub.subscribe(cOther.id, 'contracts:my');

    contractsEmitter.emit('contract.updated', {
      contractId: 'k-1',
      kind: 'permanent',
      personId: 'p-1',
      companyId: 'co-1',
      fromStatus: 'sent',
      toStatus: 'confirmed',
    });

    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(wsCompany.send).toHaveBeenCalledTimes(1);
    expect(wsOwner.send).toHaveBeenCalledTimes(1);
    expect(wsOther.send).not.toHaveBeenCalled();
  });
});
