import { uploadScanSet } from '@/api/scans';
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
import { getApiErrorMessage } from '@/lib/apiError';
import {
  type ContractKind,
  SCAN_ALLOWED_MIME,
  SCAN_MAX_FILE_SIZE,
  SCAN_MAX_PAGES,
} from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';

type Props = {
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract?: { kind: ContractKind; id: string };
  invalidateKeys?: readonly (readonly (string | number)[])[];
};

const ACCEPT = SCAN_ALLOWED_MIME.join(',');
const MAX_SIZE_MB = Math.floor(SCAN_MAX_FILE_SIZE / (1024 * 1024));

export const ScanUploadDialog = ({
  companyId,
  open,
  onOpenChange,
  contract,
  invalidateKeys,
}: Props) => {
  const qc = useQueryClient();
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setCaption('');
    setFiles([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const mutation = useMutation({
    mutationFn: () =>
      uploadScanSet({
        companyId,
        caption: caption.trim(),
        files,
        ...(contract ? { contract } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans', 'company', companyId] });
      qc.invalidateQueries({ queryKey: ['scans', 'default'] });
      for (const key of invalidateKeys ?? []) {
        qc.invalidateQueries({ queryKey: key as unknown[] });
      }
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, 'Не удалось загрузить сканы');
      setError(msg);
    },
  });

  const onFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const list = e.target.files ? Array.from(e.target.files) : [];
    const invalid = list.find((f) => !(SCAN_ALLOWED_MIME as readonly string[]).includes(f.type));
    if (invalid) {
      setError(`Файл "${invalid.name}" — недопустимый тип. Разрешены JPEG и PDF.`);
      return;
    }
    const tooBig = list.find((f) => f.size > SCAN_MAX_FILE_SIZE);
    if (tooBig) {
      setError(`Файл "${tooBig.name}" превышает ${MAX_SIZE_MB} МБ.`);
      return;
    }
    if (list.length > SCAN_MAX_PAGES) {
      setError(`Максимум ${SCAN_MAX_PAGES} страниц.`);
      return;
    }
    setFiles(list);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    setError(null);
    if (!caption.trim()) {
      setError('Укажите название пакета сканов');
      return;
    }
    if (files.length === 0) {
      setError('Добавьте хотя бы один файл');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Загрузка сканов</DialogTitle>
          <DialogDescription>
            До {SCAN_MAX_PAGES} страниц, JPEG или PDF, до {MAX_SIZE_MB} МБ каждая.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="scan-caption">Название</Label>
            <Input
              id="scan-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Например: Договор с Владом от 12.09.2026"
              maxLength={200}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scan-files">Файлы</Label>
            <input
              id="scan-files"
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={onFilesChange}
              className="text-sm"
            />
          </div>

          {files.length > 0 && (
            <ul className="grid gap-1 rounded-md border border-[var(--color-border)] p-2 text-sm">
              {files.map((f, idx) => (
                <li key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {idx + 1}. {f.name}{' '}
                    <span className="text-[var(--color-muted-fg)]">
                      ({(f.size / 1024).toFixed(0)} КБ)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-[var(--color-muted-fg)] hover:text-[var(--color-destructive)]"
                    aria-label="Удалить файл"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <NoticeBox tone="danger">{error}</NoticeBox>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Загружаем…' : 'Загрузить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
