import { useCallback, useSyncExternalStore } from 'react';

/** Ниже этой ширины проекционная витрина не помещается и переключается на мобильный вид. */
const NARROW_QUERY = '(max-width: 767px)';

/** Подписка на media query: `true`, пока ширина окна не больше 767px. */
export const useIsNarrow = (): boolean => {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = window.matchMedia(NARROW_QUERY);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
};
