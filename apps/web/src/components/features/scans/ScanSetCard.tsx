import { deleteScanSet, scanPageUrl } from '@/api/scans';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { MonoValue } from '@/components/ui/typography';
import type { ScanSetDto } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

type Props = {
  set: ScanSetDto;
  onPreview: (set: ScanSetDto) => void;
  canDelete: boolean;
  invalidateKeys?: readonly (readonly (string | number)[])[];
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const ScanSetCard = ({ set, onPreview, canDelete, invalidateKeys }: Props) => {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteScanSet(set.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans', 'company', set.companyId] });
      qc.invalidateQueries({ queryKey: ['scans', 'default'] });
      for (const key of invalidateKeys ?? []) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
      setConfirmOpen(false);
    },
  });

  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-bold">{set.caption}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MonoValue className="text-[10.5px] font-semibold text-[var(--color-subtle-fg)]">
            {formatDate(set.createdAt)}
          </MonoValue>
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label="Удалить сет"
              className="rounded-[var(--radius-sm)] p-1 text-[var(--color-muted-fg)] transition-colors hover:text-[var(--color-destructive)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Миниатюры страниц: JPEG показываем как есть, PDF — моноширинной плашкой,
          отрисовать первую страницу PDF без внешней библиотеки нельзя. */}
      <div className="mt-3 flex gap-1.5">
        {set.pages.slice(0, 3).map((p) => (
          <div
            key={p.id}
            className="flex h-[66px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-elevated)]"
          >
            {p.mimeType === 'application/pdf' ? (
              <MonoValue className="text-[9px] text-[var(--color-subtle-fg)]">PDF</MonoValue>
            ) : (
              <img src={scanPageUrl(p.id)} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <span className="truncate text-[11px] text-[var(--color-subtle-fg)]">
            {set.pages.length} стр.
            {set.pages.length > 3 ? ' · показаны 3' : ''}
          </span>
          <button
            type="button"
            onClick={() => onPreview(set)}
            className="self-start text-[11px] font-bold text-[var(--color-accent)] hover:underline"
          >
            Открыть просмотр
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сет сканов?</AlertDialogTitle>
            <AlertDialogDescription>
              «{set.caption}» будет удалён вместе со всеми файлами. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Удаляем…' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
