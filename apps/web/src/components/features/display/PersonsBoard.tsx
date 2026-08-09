import type { PersonRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { DISPLAY_SCALE } from './scale';

type PersonsBoardProps = {
  ratings: PersonRatingDto[];
  meta: Record<string, { displayName: string }>;
  limit: 'top10' | 'all';
};

const numFmt = (v: number): string => v.toLocaleString('ru-RU');

export const PersonsBoard = ({ ratings, meta, limit }: PersonsBoardProps) => {
  const sorted = useMemo(
    () => [...ratings].sort((a, b) => b.nowPermanent - a.nowPermanent),
    [ratings],
  );
  const rows = limit === 'top10' ? sorted.slice(0, 10) : sorted;

  return (
    <BoardShell
      title="Персонажи"
      subtitle={
        limit === 'top10' ? `Топ-${rows.length} из ${sorted.length}` : `Все ${sorted.length}`
      }
      columns={['Персонаж', 'Рейтинг']}
    >
      {rows.map((row, idx) => {
        const m = meta[row.personId];
        return (
          <LeaderboardRow
            key={row.personId}
            rank={idx + 1}
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
    </BoardShell>
  );
};
