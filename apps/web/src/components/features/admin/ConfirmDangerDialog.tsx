import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { type ReactNode, useState } from 'react';

type Props = {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  isLoading?: boolean;
  onConfirm: () => Promise<unknown> | undefined;
};

export const ConfirmDangerDialog = ({
  trigger,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'destructive',
  isLoading = false,
  onConfirm,
}: Props) => {
  const [open, setOpen] = useState(false);
  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {/* asChild пробрасывает обработчик на сам триггер: раньше это был
          <span onClick>, недоступный с клавиатуры и без роли кнопки. */}
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : (
            // Radix требует описание для скринридеров; без него он ругается в консоль.
            <AlertDialogDescription>Подтвердите действие.</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={isLoading}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
          >
            {isLoading ? 'Подождите…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
