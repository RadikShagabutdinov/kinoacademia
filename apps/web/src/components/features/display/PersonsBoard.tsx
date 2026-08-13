import type { PersonRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { DISPLAY_SCALE } from './scale';
import { useRotatingPage } from './useRotatingPage';

type PersonsBoardProps = {
  ratings: PersonRatingDto[];
  meta: Record<string, { displayName: string }>;
  limit: 'top10' | 'all';
  intervalSec: number;
};

const numFmt = (v: number): string => v.toLocaleString('ru-RU');

/** Сколько строк персонажей помещается на экран витрины — размер одной страницы листания. */
const PAGE_SIZE = 9;

/** Стабильные ключи для строк-заполнителей неполной последней страницы. */
const PAD_KEYS = Array.from({ length: PAGE_SIZE }, (_, i) => `pad-${i}`);

export const PersonsBoard = ({ ratings, meta, limit, intervalSec }: PersonsBoardProps) => {
  const sorted = useMemo(
    () => [...ratings].sort((a, b) => b.nowPermanent - a.nowPermanent),
    [ratings],
  );

  const paged = limit === 'all' && sorted.length > PAGE_SIZE;
  const page = useRotatingPage(paged ? Math.ceil(sorted.length / PAGE_SIZE) : 1, intervalSec);

  const start = paged ? page * PAGE_SIZE : 0;
  const rows = paged
    ? sorted.slice(start, start + PAGE_SIZE)
    : limit === 'top10'
      ? sorted.slice(0, 10)
      : sorted;

  const subtitle = paged
    ? `${start + 1}–${start + rows.length} из ${sorted.length}`
    : limit === 'top10'
      ? `Топ-${rows.length} из ${sorted.length}`
      : `Все ${sorted.length}`;

  return (
    <BoardShell title="Персонажи" subtitle={subtitle} columns={['Персонаж', 'Рейтинг']}>
      {rows.map((row, idx) => {
        const m = meta[row.personId];
        return (
          <LeaderboardRow
            key={row.personId}
            rank={start + idx + 1}
            trackedValue={row.nowPermanent}
            cells={[
              {
                key: 'name',
                content: (
                  <>
                    {m?.displayName ?? '—'}
                    {row.isStar && <span className="ml-2 text-[var(--color-star)]">★</span>}
                  </>
                ),
                className: 'font-bold',
              },
              {
                key: 'permanent',
                content: numFmt(row.nowPermanent),
                className:
                  'font-[family-name:var(--font-display)] text-right font-black tabular-nums text-[var(--color-accent)]',
                fontSize: DISPLAY_SCALE.value,
              },
            ]}
          />
        );
      })}
      {/* Добиваем неполную последнюю страницу пустыми строками: иначе auto-rows-fr
          растянет оставшиеся строки и высота списка запрыгает при листании. */}
      {paged && PAD_KEYS.slice(0, PAGE_SIZE - rows.length).map((k) => <div key={k} />)}
    </BoardShell>
  );
};
