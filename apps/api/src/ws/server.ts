import { createNodeWebSocket } from '@hono/node-ws';
import type { Env, Hono } from 'hono';
import { z } from 'zod';
import { logger } from '../logger';
import { authenticateHandshake } from './auth';
import * as hub from './hub';

const log = logger.child({ module: 'ws-server' });

const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), channel: z.string().min(1) }),
  z.object({ type: z.literal('unsubscribe'), channel: z.string().min(1) }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('pong') }),
]);

export type WsServer = ReturnType<typeof createNodeWebSocket>;

// Дженерик по Env: сюда приходит OpenAPIHono со своими Variables, а не голый Hono.
export const setupWs = <E extends Env>(app: Hono<E>): WsServer => {
  const node = createNodeWebSocket({ app });
  const { upgradeWebSocket } = node;

  app.get(
    '/ws',
    upgradeWebSocket(async (c) => {
      const user = await authenticateHandshake(c);
      let connId: string | null = null;

      return {
        onOpen: (_evt, ws) => {
          if (!user) {
            try {
              ws.close(4401, 'unauthorized');
            } catch {}
            return;
          }
          const conn = hub.register(ws, user);
          connId = conn.id;
          try {
            ws.send(JSON.stringify({ type: 'ready' }));
          } catch (err) {
            log.warn({ err }, 'failed to send ready');
          }
        },
        onMessage: async (evt, ws) => {
          if (!connId) {
            try {
              ws.close(4401, 'unauthorized');
            } catch {}
            return;
          }
          hub.touch(connId);

          let parsed: unknown;
          try {
            const data = typeof evt.data === 'string' ? evt.data : evt.data.toString();
            parsed = JSON.parse(data);
          } catch {
            hub.sendTo(connId, { type: 'error', reason: 'invalid_json' });
            return;
          }

          const result = ClientMessage.safeParse(parsed);
          if (!result.success) {
            hub.sendTo(connId, { type: 'error', reason: 'invalid_message' });
            return;
          }

          const msg = result.data;
          if (msg.type === 'ping') {
            hub.sendTo(connId, { type: 'pong' });
            return;
          }
          if (msg.type === 'pong') return;

          if (msg.type === 'subscribe') {
            const ack = await hub.subscribe(connId, msg.channel);
            hub.sendTo(connId, {
              type: ack.ok ? 'subscribed' : 'subscribe_error',
              channel: msg.channel,
              ...(ack.ok ? {} : { reason: ack.reason }),
            });
            return;
          }

          if (msg.type === 'unsubscribe') {
            hub.unsubscribe(connId, msg.channel);
            hub.sendTo(connId, { type: 'unsubscribed', channel: msg.channel });
            return;
          }
        },
        onClose: () => {
          if (connId) hub.unregister(connId);
        },
        onError: (err) => {
          log.warn({ connId, err }, 'ws error');
          if (connId) hub.unregister(connId);
        },
      };
    }),
  );

  return node;
};
