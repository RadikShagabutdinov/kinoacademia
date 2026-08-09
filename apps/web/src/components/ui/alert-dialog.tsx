import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ComponentPropsWithoutRef, type HTMLAttributes, forwardRef } from 'react';

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogOverlay = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/60', className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

export const AlertDialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-[var(--color-card-fg)] shadow-lg',
        className,
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = 'AlertDialogContent';

export const AlertDialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);

export const AlertDialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

export const AlertDialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--color-muted-fg)]', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

type AlertDialogActionVariant =
  | 'default'
  | 'destructive'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export const AlertDialogAction = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & {
    variant?: AlertDialogActionVariant;
  }
>(({ className, variant = 'destructive', ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants({ variant }), className)}
    {...props}
  />
));
AlertDialogAction.displayName = 'AlertDialogAction';

export const AlertDialogCancel = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';
