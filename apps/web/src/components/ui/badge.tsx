import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

// Бейдж в макете — капслок с разрядкой, тонированная заливка и рамка того же тона.
const tinted = (token: string) =>
  `border-[color-mix(in_oklab,var(${token})_35%,transparent)] bg-[color-mix(in_oklab,var(${token})_13%,transparent)] text-[var(${token})]`;

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
        secondary: 'border-transparent bg-[var(--color-muted)] text-[var(--color-fg)]',
        destructive: tinted('--color-destructive'),
        outline: 'border-[var(--color-border)] text-[var(--color-muted-fg)]',
        success: tinted('--color-success'),
        warning: tinted('--color-warning'),
        accent: tinted('--color-accent'),
        // Звезда в макете — единственный сплошной бейдж: её видно издалека.
        star: 'border-transparent bg-[var(--color-star)] text-[var(--color-star-fg)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { badgeVariants };
