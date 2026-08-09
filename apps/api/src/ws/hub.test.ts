import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../auth/middleware';

vi.mock('./channels', () => ({
  canSubscribe: vi.fn(),
  personChannel: (id: string) => `person:${id}`,
  companyChannel: (id: string) => `company:${id}`,
}));

import * as channels from './channels';
import * as hub from './hub';

type FakeWs = { send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

const fakeWs = (): FakeWs => ({ send: vi.fn(), close: vi.fn() });

const user = (id = 'u-1'): AuthUser => ({ id, role: 'admin' });

beforeEach(() => {
  hub._internal.reset();
  vi.mocked(channels.canSubscribe).mockReset();
});

describe('hub', () => {
  it('register adds connection, unregister removes and clears subscriptions', async () => {
    vi.mocked(channels.canSubscribe).mockResolvedValue({ ok: true });
    const ws = fakeWs();
    const conn = hub.register(ws as never, user());
    expect(hub._internal.connections.size).toBe(1);

    const ack = await hub.subscribe(conn.id, 'system');
    expect(ack).toEqual({ ok: true });
    expect(hub._internal.subscribers.get('system')?.size).toBe(1);

    hub.unregister(conn.id);
    expect(hub._internal.connections.size).toBe(0);
    expect(hub._internal.subscribers.get('system')).toBeUndefined();
  });

  it('subscribe returns reason on canSubscribe rejection', async () => {
    vi.mocked(channels.canSubscribe).mockResolvedValue({ ok: false, reason: 'forbidden' });
    const ws = fakeWs();
    const conn = hub.register(ws as never, user());
    const ack = await hub.subscribe(conn.id, 'person:other');
    expect(ack).toEqual({ ok: false, reason: 'forbidden' });
    expect(hub._internal.subscribers.get('person:other')).toBeUndefined();
  });

  it('broadcast delivers only to subscribers of channel', async () => {
    vi.mocked(channels.canSubscribe).mockResolvedValue({ ok: true });
    const wsA = fakeWs();
    const wsB = fakeWs();
    const a = hub.register(wsA as never, user('u-a'));
    const b = hub.register(wsB as never, user('u-b'));
    await hub.subscribe(a.id, 'system');
    await hub.subscribe(b.id, 'ratings:all');

    hub.broadcast('system', 'msg', { x: 1 });
    expect(wsA.send).toHaveBeenCalledTimes(1);
    expect(wsB.send).not.toHaveBeenCalled();

    const sent = JSON.parse(wsA.send.mock.calls[0]?.[0] as string);
    expect(sent.channel).toBe('system');
    expect(sent.type).toBe('msg');
    expect(sent.payload).toEqual({ x: 1 });
    expect(typeof sent.ts).toBe('string');
  });

  it('broadcastToUser filters by user.id', async () => {
    vi.mocked(channels.canSubscribe).mockResolvedValue({ ok: true });
    const wsA = fakeWs();
    const wsB = fakeWs();
    const a = hub.register(wsA as never, user('u-a'));
    const b = hub.register(wsB as never, user('u-b'));
    await hub.subscribe(a.id, 'contracts:my');
    await hub.subscribe(b.id, 'contracts:my');

    hub.broadcastToUser('u-a', 'contracts:my', 'contract.updated', { id: 'c-1' });
    expect(wsA.send).toHaveBeenCalledTimes(1);
    expect(wsB.send).not.toHaveBeenCalled();
  });

  it('unsubscribe removes connection from channel', async () => {
    vi.mocked(channels.canSubscribe).mockResolvedValue({ ok: true });
    const ws = fakeWs();
    const conn = hub.register(ws as never, user());
    await hub.subscribe(conn.id, 'system');
    hub.unsubscribe(conn.id, 'system');
    hub.broadcast('system', 'msg', {});
    expect(ws.send).not.toHaveBeenCalled();
  });
});
