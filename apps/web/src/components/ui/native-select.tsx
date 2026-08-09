import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { type SelectHTMLAttributes, forwardRef } from 'react';

/**
 * Нативный `<select>` в стиле макета. Radix-версия (`ui/select.tsx`) остаётся для
 * мест, где нужен богатый попап, — внутри диалогов нативный ведёт себя надёжнее,
 * а на мобильных даёт системный пикер.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 pr-9 text-sm font-semibold text-[var(--color-fg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-fg)]"
      />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';
