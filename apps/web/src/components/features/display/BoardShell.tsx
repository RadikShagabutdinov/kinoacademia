import type { ReactNode } from 'react';
import { DISPLAY_SCALE, gridTemplate } from './scale';

type Props = {
  title: string;
  subtitle: string;
  /** Подписи столбцов после номера — их ровно столько, сколько ячеек в строке. */
  columns: string[];
  children: ReactNode;
};

/**
 * Общая рамка колонки лидерборда: заголовок акцидентным шрифтом, счётчик справа
 * и шапка столбцов. PersonsBoard и CompaniesBoard раньше повторяли её дословно.
 */
export const BoardShell = ({ title, subtitle, columns, children }: Props) => (
  <section className="flex h-full min-h-0 flex-col">
    <div className="flex items-baseline justify-between gap-4 border-b-2 border-[var(--color-border)] pb-[1.4vh]">
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
      className="grid items-center gap-[1vw] px-[1.5vw] py-[0.9vh] font-bold uppercase tracking-[0.1em] text-[var(--color-subtle-fg)]"
      style={{
        gridTemplateColumns: gridTemplate(columns.length),
        fontSize: DISPLAY_SCALE.columnLabel,
      }}
    >
      <span>#</span>
      {columns.map((label, i) => (
        <span key={label} className={i === columns.length - 1 ? 'text-right' : undefined}>
          {label}
        </span>
      ))}
    </div>

    <div className="grid min-h-0 flex-1 auto-rows-fr">{children}</div>
  </section>
);
