import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

const TONES = {
  star: 'border-[color-mix(in_oklab,var(--color-star)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-star)_9%,transparent)] text-[var(--color-star)]',
  danger:
    'border-[color-mix(in_oklab,var(--color-destructive)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] text-[var(--color-destructive)]',
  accent:
    'border-[color-mix(in_oklab,var(--color-accent)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]',
  muted: 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-fg)]',
} as const;

type NoticeBoxProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof TONES;
};

/**
 * Тонированная плашка-пояснение: условие статуса Звезды, предупреждение о штрафе,
 * нейтральная сноска. В макете встречается на большинстве экранов.
 */
export const NoticeBox = ({ className, tone = 'muted', ...props }: NoticeBoxProps) => (
  <div
    className={cn(
      'rounded-[var(--radius-md)] border px-3.5 py-3 text-xs font-semibold leading-relaxed',
      TONES[tone],
      className,
    )}
    {...props}
  />
);
