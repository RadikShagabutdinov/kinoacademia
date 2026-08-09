import type { WsEventOf } from '@kinoacademia/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { wsClient } from '../lib/wsClient';

/**
 * Подписка на WS-канал. Возвращает unsubscribe из эффекта.
 * @param channel Имя канала (`person:{id}`, `ratings:all`, `contracts:my`, ...).
 * @param onEvent Callback на каждое событие в канале.
 */
export const useWsChannel = <T = unknown>(
  channel: string | null | undefined,
  onEvent: (event: WsEventOf<T>) => void,
): void => {
  useEffect(() => {
    if (!channel) return;
    const unsubscribe = wsClient.subscribe(channel, (envelope) => {
      onEvent(envelope as WsEventOf<T>);
    });
    return unsubscribe;
  }, [channel, onEvent]);
};

let wsOnline = false;

/** Живо ли WS-соединение — для индикатора realtime в шапке. */
export const useWsOnline = (): boolean =>
  useSyncExternalStore(
    (notify) =>
      wsClient.onStatus((online) => {
        wsOnline = online;
        notify();
      }),
    () => wsOnline,
    () => false,
  );
