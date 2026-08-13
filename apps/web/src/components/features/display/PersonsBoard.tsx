import { formatAmount, formatSigned, signedTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { PersonRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { type BoardColumn, BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { COLUMN_WIDTHS, DISPLAY_SCALE, NARROW_COLUMN_WIDTHS } from './scale';
import { useRotatingPage } from './useRotatingPage';

type PersonsBoardProps = {
  ratings: PersonRatingDto[];
  meta: Record<string, { displayName: string }>;
  limit: 'top10' | 'all';
  intervalSec: number;
  /** Мобильный вид: весь список одной прокруткой, без автолистания. */
  narrow: boolean;
};

/** Сколько строк персонажей помещается на экран витрины — размер одной страницы листания. */
const PAGE_SIZE = 9;

/** Стабильные ключи для строк-заполнителей неполной последней страницы. */
const PAD_KEYS = Array.from({ length: PAGE_SIZE }, (_, i) => `pad-${i}`);

export const PersonsBoard = ({ ratings, meta, limit, intervalSec, narrow }: PersonsBoardProps) => {
  const sorted = useMemo(
    () => [...ratings].sort((a, b) => b.nowPermanent - a.nowPermanent),
    [ratings],
  );

  const widths = narrow ? NARROW_COLUMN_WIDTHS : COLUMN_WIDTHS;
  const columns: readonly BoardColumn[] = [
    { label: 'Персонаж', width: widths.name },
    { label: 'Рейтинг', width: widths.value, alignRight: true },
    { label: 'Изм.', width: widths.delta, alignRight: true },
  ];

  const paged = !narrow && limit === 'all' && sorted.length > PAGE_SIZE;
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
    <BoardShell
      title="Персонажи"
      subtitle={subtitle}
      columns={columns}
      rankWidth={widths.rank}
      narrow={narrow}
    >
      {rows.map((row, idx) => {
        const m = meta[row.personId];
        // Разница с предыдущим значением постоянного рейтинга — величина последнего изменения.
        const delta = row.nowPermanent - row.lastPermanent;
        return (
          <LeaderboardRow
            key={row.personId}
            rank={start + idx + 1}
            trackedValue={row.nowPermanent}
            rankWidth={widths.rank}
            narrow={narrow}
            cells={[
              {
                key: 'name',
                width: widths.name,
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
                width: widths.value,
                content: formatAmount(row.nowPermanent),
                className:
                  'font-[family-name:var(--font-display)] text-right font-black tabular-nums text-[var(--color-accent)]',
                fontSize: DISPLAY_SCALE.value,
              },
              {
                key: 'delta',
                width: widths.delta,
                content: delta === 0 ? '—' : `${delta > 0 ? '▲' : '▼'} ${formatSigned(delta)}`,
                className: cn('text-right font-bold tabular-nums', signedTone(delta)),
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
