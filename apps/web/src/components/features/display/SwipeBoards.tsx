import { cn } from '@/lib/utils';
import { type ReactNode, type UIEvent, useCallback, useRef, useState } from 'react';

type Props = {
  persons: ReactNode;
  companies: ReactNode;
};

const TABS = ['Персонажи', 'Компании'] as const;

/**
 * Мобильный вид витрины: два блока рядом не помещаются, поэтому показываем один
 * на всю ширину и переключаем табами либо горизонтальным свайпом. Свайп — нативный
 * скролл со снапом (не Radix Tabs: он размонтирует неактивную панель, и свайпать нечего).
 */
export const SwipeBoards = ({ persons, companies }: Props) => {
  const pagerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0;
    setActive((prev) => (prev === idx ? prev : idx));
  }, []);

  const goTo = (idx: number) => {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {TABS.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(idx)}
            className={cn(
              'flex-1 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold transition-colors',
              active === idx
                ? 'bg-[var(--color-accent)] font-extrabold text-[var(--color-accent-fg)]'
                : 'text-[var(--color-muted-fg)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        ref={pagerRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-full shrink-0 snap-start">{persons}</div>
        <div className="w-full shrink-0 snap-start">{companies}</div>
      </div>
    </div>
  );
};
