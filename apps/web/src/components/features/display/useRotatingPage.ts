import { useEffect, useState } from 'react';

/**
 * Циклически листает страницы списка каждые intervalSec секунд.
 * При pageCount <= 1 всегда возвращает 0; индекс клампится, если страниц стало меньше.
 */
export const useRotatingPage = (pageCount: number, intervalSec: number): number => {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pageCount <= 1) {
      setPage(0);
      return;
    }
    const id = setInterval(
      () => setPage((p) => (p + 1) % pageCount),
      Math.max(2, intervalSec) * 1000,
    );
    return () => clearInterval(id);
  }, [pageCount, intervalSec]);

  return page < pageCount ? page : 0;
};
