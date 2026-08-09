import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import type { ComponentType, SVGProps } from 'react';

type Props = {
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  /** Подпись под заголовком. `tone="alert"` подсвечивает её точкой — как «1 предложение» в макете. */
  hint?: string;
  tone?: 'muted' | 'alert';
  accentIcon?: boolean;
  className?: string;
};

export const ActionTile = ({
  to,
  icon: Icon,
  title,
  hint,
  tone = 'muted',
  accentIcon = false,
  className,
}: Props) => (
  <Link
    to={to}
    className={cn(
      'block rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-accent)]',
      className,
    )}
  >
    <Icon
      className="h-5 w-5"
      style={{ color: accentIcon ? 'var(--color-accent)' : 'var(--color-muted-fg)' }}
    />
    <div className="mt-3 text-sm font-bold leading-tight">{title}</div>
    {hint && (
      <div
        className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold"
        style={{
          color: tone === 'alert' ? 'var(--color-destructive)' : 'var(--color-subtle-fg)',
        }}
      >
        {tone === 'alert' && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
        {hint}
      </div>
    )}
  </Link>
);
