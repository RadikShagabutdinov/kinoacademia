import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

/**
 * Надзаголовок раздела: капслок с широкой разрядкой приглушённым цветом.
 * В макете им размечен каждый смысловой блок («ПОСТОЯННЫЙ РЕЙТИНГ», «ИСТОРИЯ»).
 */
export const SectionLabel = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--color-muted-fg)]',
      className,
    )}
    {...props}
  />
);

/** Заголовок экрана в акцидентном шрифте — так озаглавлен каждый экран макета. */
export const PageTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h1
    className={cn(
      'font-[family-name:var(--font-display)] text-[22px] font-black leading-none tracking-tight',
      className,
    )}
    {...props}
  />
);

const NUMBER_SIZES = {
  sm: 'text-[20px]',
  md: 'text-[30px]',
  lg: 'text-[46px]',
  xl: 'text-[60px]',
} as const;

type DisplayNumberProps = HTMLAttributes<HTMLDivElement> & {
  size?: keyof typeof NUMBER_SIZES;
};

/**
 * Крупная сумма рейтинга: акцидентный шрифт, моноширинные цифры.
 * `tabular-nums` обязателен — иначе цифры прыгают при live-обновлении по WS.
 */
export const DisplayNumber = ({ className, size = 'md', ...props }: DisplayNumberProps) => (
  <div
    className={cn(
      'font-[family-name:var(--font-display)] font-black leading-none tracking-tight tabular-nums',
      NUMBER_SIZES[size],
      className,
    )}
    {...props}
  />
);

/** Числа в плотных списках и метки времени — моноширинный шрифт из макета. */
export const MonoValue = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn('font-[family-name:var(--font-mono)] font-bold tabular-nums', className)}
    {...props}
  />
);
