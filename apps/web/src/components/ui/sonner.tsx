import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';

export const Toaster = (props: ToasterProps) => (
  <SonnerToaster
    position="top-right"
    richColors
    closeButton
    toastOptions={{
      classNames: {
        toast:
          'rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-card-fg)] shadow-md',
      },
    }}
    {...props}
  />
);

export { toast } from 'sonner';
