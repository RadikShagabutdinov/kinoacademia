import { cn } from '@/lib/utils';
import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  forwardRef,
} from 'react';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-[12.5px]', className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('[&_tr]:border-b border-[var(--color-border)]', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      '[&_tr:last-child]:border-0',
      // Зебра из макета: считать индекс в самих строках не нужно.
      '[&_tr:nth-child(even)]:bg-[var(--color-row-alt)]',
      className,
    )}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)] data-[state=selected]:bg-[var(--color-muted)]',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-9 bg-[var(--color-card)] px-3 text-left align-middle text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--color-subtle-fg)]',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-3 py-2.5 align-middle', className)} {...props} />
  ),
);
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-[var(--color-muted-fg)]', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';
