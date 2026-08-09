import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { Copy } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  temporaryPassword: string | null;
  login?: string | null;
};

export const TempPasswordDialog = ({ open, onOpenChange, temporaryPassword, login }: Props) => {
  const copy = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    toast.success('Пароль скопирован');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Временный пароль</DialogTitle>
          <DialogDescription>
            Передайте пароль пользователю. После закрытия окна он больше не отобразится.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
          {login ? (
            <div className="text-xs text-[var(--color-muted-fg)]">Логин: {login}</div>
          ) : null}
          <code className="block break-all text-base font-semibold">{temporaryPassword}</code>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copy} type="button">
            <Copy className="mr-2 h-4 w-4" />
            Скопировать
          </Button>
          <Button onClick={() => onOpenChange(false)} type="button">
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
