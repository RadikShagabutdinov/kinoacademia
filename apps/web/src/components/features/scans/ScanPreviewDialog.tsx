import { scanPageUrl } from '@/api/scans';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ScanSetDto } from '@kinoacademia/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  set: ScanSetDto | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const ScanPreviewDialog = ({ set, open, onOpenChange }: Props) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const pages = set?.pages ?? [];
  const current = pages[index];
  const total = pages.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{set?.caption ?? 'Скан'}</DialogTitle>
        </DialogHeader>

        {current ? (
          <div className="space-y-3">
            <div className="flex h-[60vh] items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
              {current.mimeType === 'application/pdf' ? (
                <iframe
                  key={current.id}
                  src={scanPageUrl(current.id)}
                  title={`Страница ${index + 1}`}
                  className="h-full w-full"
                />
              ) : (
                <img
                  key={current.id}
                  src={scanPageUrl(current.id)}
                  alt={`Страница ${index + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Пред
              </Button>
              <span className="text-sm text-[var(--color-muted-fg)]">
                {index + 1} / {total}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index >= total - 1}
              >
                След <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--color-muted-fg)]">Страниц нет.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
