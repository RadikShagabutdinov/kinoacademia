import { cn } from '@/lib/utils';
import { MonoValue } from './typography';

type MetricBarProps = {
  label: string;
  value: number;
  /**
   * Знаменатель для ширины полосы. Полоса показывает вклад составляющей
   * относительно самой крупной в наборе — абсолютной шкалы у рейтинга нет.
   */
  max: number;
  /** CSS-цвет заливки; по умолчанию — акцент текущей темы. */
  color?: string;
};

const formatSigned = (n: number): string => (n > 0 ? `+${n}` : String(n));

export const MetricBar = ({ label, value, max, color }: MetricBarProps) => {
  const width = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[92px] shrink-0 text-[11.5px] font-semibold text-[var(--color-muted-fg)]">
        {label}
      </span>
      <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${width}%`, background: color ?? 'var(--color-accent)' }}
        />
      </div>
      <MonoValue
        className={cn(
          'w-14 shrink-0 text-right text-[11.5px]',
          value < 0 ? 'text-[var(--color-destructive)]' : 'text-[var(--color-fg)]',
        )}
      >
        {formatSigned(value)}
      </MonoValue>
    </div>
  );
};
