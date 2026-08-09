import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NoticeBox } from '@/components/ui/notice-box';
import { type ReactNode, useState } from 'react';

type Tone = 'default' | 'destructive';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  warning?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Tone;
  isPending?: boolean;
  withComment?: boolean;
  onConfirm: (comment?: string) => void;
};

export const ConfirmActionDialog = ({
  open,
  onOpenChange,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel = 'Отмена',
  tone = 'default',
  isPending,
  withComment = false,
  onConfirm,
}: Props) => {
  const [comment, setComment] = useState('');

  const handleConfirm = () => onConfirm(withComment && comment ? comment : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {warning && (
          <NoticeBox tone={tone === 'destructive' ? 'danger' : 'accent'}>{warning}</NoticeBox>
        )}
        {withComment && (
          <div className="grid gap-2">
            <Label htmlFor="contract-comment">Комментарий (необязательно)</Label>
            <Input
              id="contract-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? 'Отправляем…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
