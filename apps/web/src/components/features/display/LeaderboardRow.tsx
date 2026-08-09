import { useFlashOnChange } from '@/hooks/useFlashOnChange';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { DISPLAY_SCALE, gridTemplate } from './scale';

type Cell = {
  key: string;
  content: ReactNode;
  className?: string;
  /** Собственный размер шрифта из шкалы; по умолчанию — размер имени. */
  fontSize?: string;
};

type LeaderboardRowProps = {
  rank: number;
  trackedValue: number;
  cells: Cell[];
};

export const LeaderboardRow = ({ rank, trackedValue, cells }: LeaderboardRowProps) => {
  const flash = useFlashOnChange(trackedValue);

  return (
    <div
      className={cn(
        'grid items-center gap-[1vw] border-b border-[var(--color-hairline)] px-[1.5vw] py-[0.6vh]',
        flash && 'animate-flash',
      )}
      style={{ gridTemplateColumns: gridTemplate(cells.length) }}
    >
      {/* Лидер выделен золотом — в макете первое место читается издалека. */}
      <span
        className={cn(
          'font-[family-name:var(--font-mono)] font-bold tabular-nums',
          rank === 1 ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted-fg)]',
        )}
        style={{ fontSize: DISPLAY_SCALE.rank }}
      >
        {rank}
      </span>
      {cells.map((cell) => (
        <span
          key={cell.key}
          className={cn('truncate', cell.className)}
          style={{ fontSize: cell.fontSize ?? DISPLAY_SCALE.name }}
        >
          {cell.content}
        </span>
      ))}
    </div>
  );
};
