import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { DISPLAY_SCALE, gridTemplate } from './scale';

export type BoardColumn = {
  label: string;
  /** Ширина из набора `ColumnWidths` — должна совпадать с шириной ячейки в строке. */
  width: string;
  alignRight?: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  /** Столбцы после номера — их ровно столько, сколько ячеек в строке. */
  columns: readonly BoardColumn[];
  rankWidth: string;
  /** Мобильный вид: список прокручивается пальцем, а не растягивается на высоту экрана. */
  narrow: boolean;
  children: ReactNode;
};

/**
 * Общая рамка колонки лидерборда: заголовок акцидентным шрифтом, счётчик справа
 * и шапка столбцов. PersonsBoard и CompaniesBoard раньше повторяли её дословно.
 */
export const BoardShell = ({ title, subtitle, columns, rankWidth, narrow, children }: Props) => (
  <section className="flex h-full min-h-0 flex-col">
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b-2 border-[var(--color-border)]',
        narrow ? 'pb-2' : 'pb-[1.4vh]',
      )}
    >
      <h2
        className="font-[family-name:var(--font-display)] font-black leading-none"
        style={{ fontSize: DISPLAY_SCALE.boardTitle }}
      >
        {title}
      </h2>
      <span
        className="font-bold uppercase tracking-[0.14em] text-[var(--color-subtle-fg)]"
        style={{ fontSize: DISPLAY_SCALE.columnLabel }}
      >
        {subtitle}
      </span>
    </div>

    <div
      className={cn(
        'grid items-center font-bold uppercase tracking-[0.1em] text-[var(--color-subtle-fg)]',
        narrow ? 'gap-2 px-2 py-2' : 'gap-[1vw] px-[1.5vw] py-[0.9vh]',
      )}
      style={{
        gridTemplateColumns: gridTemplate(
          rankWidth,
          columns.map((c) => c.width),
        ),
        fontSize: DISPLAY_SCALE.columnLabel,
      }}
    >
      <span>#</span>
      {columns.map((c) => (
        <span key={c.label} className={cn('truncate', c.alignRight && 'text-right')}>
          {c.label}
        </span>
      ))}
    </div>

    <div
      className={cn(
        'grid min-h-0 flex-1',
        narrow ? 'auto-rows-min overflow-y-auto overscroll-contain' : 'auto-rows-fr',
      )}
    >
      {children}
    </div>
  </section>
);
