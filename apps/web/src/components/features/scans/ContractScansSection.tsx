import { getScanSet, listCompanyScanSets } from '@/api/scans';
import { Button } from '@/components/ui/button';
import type { ContractKind, ScanSetDto } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScanPreviewDialog } from './ScanPreviewDialog';
import { ScanUploadDialog } from './ScanUploadDialog';

type Props = {
  contract: { kind: ContractKind; id: string };
  companyId: string;
  /** Может ли текущий пользователь загружать сканы в компанию (head/admin). */
  canUpload: boolean;
  /** Для fallback-поиска сета по contractId, когда ContractDto без scanSetId. */
  invalidateKeys?: readonly (readonly (string | number)[])[];
};

/**
 * Секция «Сканы контракта» для карточек контрактов (игрок и компания).
 *
 * ContractDto пока не содержит scanSetId — поэтому ищем сет через список компании
 * и фильтруем по `contract.id`. Это единственный вызов на страницу контрактов
 * (список уже загружен на странице документов, но здесь отдельный ключ, чтобы
 * секция была самодостаточной и не зависела от порядка загрузки).
 */
export const ContractScansSection = ({ contract, companyId, canUpload, invalidateKeys }: Props) => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<ScanSetDto | null>(null);

  const { data: sets = [], isLoading } = useQuery({
    queryKey: ['scans', 'company', companyId],
    queryFn: () => listCompanyScanSets(companyId),
    staleTime: 30_000,
  });

  const attached = useMemo(
    () => sets.find((s) => s.contract && s.contract.id === contract.id),
    [sets, contract.id],
  );

  // Если сет привязан, но список компании урезан (у игрока фильтрация по доступу),
  // подгружаем сет напрямую по id.
  const { data: directSet } = useQuery({
    queryKey: ['scans', 'set', attached?.id ?? 'none'],
    queryFn: () => getScanSet(attached?.id ?? ''),
    enabled: Boolean(attached),
    staleTime: 30_000,
  });

  const scanSet = directSet ?? attached ?? null;

  return (
    <div className="border-t border-[var(--color-border)] px-6 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-[var(--color-muted-fg)]" />
          <span className="font-medium">Сканы</span>
          {scanSet ? (
            <span className="text-[var(--color-muted-fg)]">
              · {scanSet.caption} ({scanSet.pages.length} стр.)
            </span>
          ) : (
            <span className="text-[var(--color-muted-fg)]">
              · {isLoading ? 'загрузка…' : 'не прикреплены'}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {scanSet && (
            <Button size="sm" variant="outline" onClick={() => setPreview(scanSet)}>
              Открыть
            </Button>
          )}
          {canUpload && !scanSet && (
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Прикрепить
            </Button>
          )}
        </div>
      </div>

      {canUpload && (
        <ScanUploadDialog
          companyId={companyId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          contract={contract}
          {...(invalidateKeys ? { invalidateKeys } : {})}
        />
      )}
      <ScanPreviewDialog
        set={preview}
        open={preview !== null}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      />
    </div>
  );
};
