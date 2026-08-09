import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90',
        // В макете опасное действие — контурная кнопка, а не залитая: заливка
        // красным осталась бы только за подтверждением в модалке.
        destructive:
          'border border-[color-mix(in_oklab,var(--color-destructive)_45%,transparent)] bg-transparent text-[var(--color-destructive)] hover:bg-[color-mix(in_oklab,var(--color-destructive)_12%,transparent)]',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-muted-fg)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]',
        secondary: 'bg-[var(--color-muted)] text-[var(--color-fg)] hover:opacity-90',
        ghost: 'hover:bg-[var(--color-muted)]',
        link: 'text-[var(--color-accent)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        // Основной размер на мобильных экранах макета — полноширинная кнопка.
        xl: 'h-12 w-full px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
