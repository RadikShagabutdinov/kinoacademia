import { randomUUID } from 'node:crypto';
import type { WsEventEnvelope } from '@kinoacademia/shared';
import type { WSContext } from 'hono/ws';
import type { AuthUser } from '../auth/middleware';
import { logger } from '../logger';
import { canSubscribe } from './channels';

const log = logger.child({ module: 'ws-hub' });

export type ConnState = {
  id: string;
  user: AuthUser;
  ws: WSContext;
  channels: Set<string>;
  lastSeenAt: number;
};

const connections: Map<string, ConnState> = new Map();
const subscribers: Map<string, Set<string>> = new Map();

const safeSend = (conn: ConnState, data: unknown): void => {
  try {
    conn.ws.send(JSON.stringify(data));
  } catch (err) {
    log.warn({ connId: conn.id, err }, 'failed to send ws message');
  }
};

export const register = (ws: WSContext, user: AuthUser): ConnState => {
  const conn: ConnState = {
    id: randomUUID(),
    user,
    ws,
    channels: new Set(),
    lastSeenAt: Date.now(),
  };
  connections.set(conn.id, conn);
  return conn;
};

export const unregister = (connId: string): void => {
  const conn = connections.get(connId);
  if (!conn) return;
  for (const channel of conn.channels) {
    subscribers.get(channel)?.delete(connId);
    if (subscribers.get(channel)?.size === 0) subscribers.delete(channel);
  }
  connections.delete(connId);
};

export type SubscribeResult = { ok: true } | { ok: false; reason: string };

export const subscribe = async (connId: string, channel: string): Promise<SubscribeResult> => {
  const conn = connections.get(connId);
  if (!conn) return { ok: false, reason: 'unknown_connection' };

  const allowed = await canSubscribe(conn.user, channel);
  if (!allowed.ok) return allowed;

  conn.channels.add(channel);
  let set = subscribers.get(channel);
  if (!set) {
    set = new Set();
    subscribers.set(channel, set);
  }
  set.add(connId);
  return { ok: true };
};

export const unsubscribe = (connId: string, channel: string): void => {
  const conn = connections.get(connId);
  if (!conn) return;
  conn.channels.delete(channel);
  const set = subscribers.get(channel);
  if (!set) return;
  set.delete(connId);
  if (set.size === 0) subscribers.delete(channel);
};

const buildEnvelope = (channel: string, type: string, payload: unknown): WsEventEnvelope => ({
  channel,
  type,
  payload,
  ts: new Date().toISOString(),
});

export const broadcast = (channel: string, type: string, payload: unknown): void => {
  const set = subscribers.get(channel);
  if (!set || set.size === 0) return;
  const envelope = buildEnvelope(channel, type, payload);
  const json = JSON.stringify(envelope);
  for (const connId of set) {
    const conn = connections.get(connId);
    if (!conn) continue;
    try {
      conn.ws.send(json);
    } catch (err) {
      log.warn({ connId, err }, 'failed to broadcast ws message');
    }
  }
};

/**
 * Шлёт событие в указанный канал только тем подписчикам, чей user.id совпадает.
 * Используется для канала `contracts:my`.
 */
export const broadcastToUser = (
  userId: string,
  channel: string,
  type: string,
  payload: unknown,
): void => {
  const set = subscribers.get(channel);
  if (!set || set.size === 0) return;
  const envelope = buildEnvelope(channel, type, payload);
  const json = JSON.stringify(envelope);
  for (const connId of set) {
    const conn = connections.get(connId);
    if (!conn || conn.user.id !== userId) continue;
    try {
      conn.ws.send(json);
    } catch (err) {
      log.warn({ connId, err }, 'failed to broadcast ws message');
    }
  }
};

export const sendTo = (connId: string, data: unknown): void => {
  const conn = connections.get(connId);
  if (!conn) return;
  safeSend(conn, data);
};

export const touch = (connId: string): void => {
  const conn = connections.get(connId);
  if (conn) conn.lastSeenAt = Date.now();
};

export const getConnection = (connId: string): ConnState | undefined => connections.get(connId);

export const _internal = {
  connections,
  subscribers,
  reset(): void {
    connections.clear();
    subscribers.clear();
  },
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_TIMEOUT_MS = 60_000;

let heartbeatTimer: NodeJS.Timeout | null = null;

export const startHeartbeat = (): void => {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const conn of connections.values()) {
      if (now - conn.lastSeenAt > STALE_TIMEOUT_MS) {
        try {
          conn.ws.close(4408, 'stale');
        } catch {}
        unregister(conn.id);
        continue;
      }
      safeSend(conn, { type: 'ping' });
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();
};

export const stopHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};
