import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, forwardRef } from 'react';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex w-full items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 text-[var(--color-muted-fg)]',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold ring-offset-[var(--color-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--color-accent)] data-[state=active]:font-extrabold data-[state=active]:text-[var(--color-accent-fg)]',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 ring-offset-[var(--color-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
