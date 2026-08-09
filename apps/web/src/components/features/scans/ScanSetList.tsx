import type { ScanSetDto } from '@kinoacademia/shared';
import { useState } from 'react';
import { ScanPreviewDialog } from './ScanPreviewDialog';
import { ScanSetCard } from './ScanSetCard';

type Props = {
  sets: ScanSetDto[];
  canDelete: boolean;
  emptyText?: string;
  invalidateKeys?: readonly (readonly (string | number)[])[];
};

export const ScanSetList = ({
  sets,
  canDelete,
  emptyText = 'Сканов пока нет.',
  invalidateKeys,
}: Props) => {
  const [preview, setPreview] = useState<ScanSetDto | null>(null);

  if (sets.length === 0) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{emptyText}</p>;
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {sets.map((set) => (
          <ScanSetCard
            key={set.id}
            set={set}
            canDelete={canDelete}
            onPreview={setPreview}
            {...(invalidateKeys ? { invalidateKeys } : {})}
          />
        ))}
      </div>

      <ScanPreviewDialog
        set={preview}
        open={preview !== null}
        onOpenChange={(v) => {
          if (!v) setPreview(null);
        }}
      />
    </>
  );
};
