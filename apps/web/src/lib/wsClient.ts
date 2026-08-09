import type { WsEventEnvelope } from '@kinoacademia/shared';

type ChannelHandler = (event: WsEventEnvelope) => void;
type StatusHandler = (online: boolean) => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

const resolveUrl = (): string => {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
};

class WsClient {
  private ws: WebSocket | null = null;
  private url = resolveUrl();
  private handlers: Map<string, Set<ChannelHandler>> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private outbox: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;
  private intentionalClose = false;
  private statusHandlers: Set<StatusHandler> = new Set();
  private online = false;

  connect(): void {
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.connecting = true;
    this.intentionalClose = false;

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.connecting = false;
      this.reconnectAttempt = 0;
      this.setOnline(true);
      for (const channel of this.subscribedChannels) {
        this.sendRaw({ type: 'subscribe', channel });
      }
      while (this.outbox.length > 0) {
        const msg = this.outbox.shift();
        if (msg) ws.send(msg);
      }
    });

    ws.addEventListener('message', (evt) => {
      let data: unknown;
      try {
        data = JSON.parse(typeof evt.data === 'string' ? evt.data : '');
      } catch {
        return;
      }
      if (!data || typeof data !== 'object') return;
      const obj = data as Record<string, unknown>;
      if (obj.type === 'ping') {
        this.sendRaw({ type: 'pong' });
        return;
      }
      if (typeof obj.channel === 'string' && typeof obj.type === 'string' && 'ts' in obj) {
        const envelope = obj as unknown as WsEventEnvelope;
        const set = this.handlers.get(envelope.channel);
        if (set) for (const h of set) h(envelope);
      }
    });

    ws.addEventListener('close', (evt) => {
      this.connecting = false;
      this.ws = null;
      this.setOnline(false);
      if (this.intentionalClose) return;
      if (evt.code === 4401) return;
      this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      try {
        ws.close();
      } catch {}
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  subscribe(channel: string, handler: ChannelHandler): () => void {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
    }
    set.add(handler);

    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      this.sendRaw({ type: 'subscribe', channel });
    }
    this.connect();

    return () => {
      const handlers = this.handlers.get(channel);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
        this.sendRaw({ type: 'unsubscribe', channel });
      }
    };
  }

  /**
   * Подписка на состояние соединения — питает индикатор «realtime» в шапке.
   * Обработчик вызывается сразу с текущим значением, чтобы не ждать первого события.
   */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.online);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    for (const h of this.statusHandlers) h(online);
  }

  private sendRaw(payload: unknown): void {
    const json = JSON.stringify(payload);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(json);
    } else {
      this.outbox.push(json);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new WsClient();
