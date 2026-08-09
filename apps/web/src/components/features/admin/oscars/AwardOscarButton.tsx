import { awardOscar } from '@/api/oscars';
import { ConfirmDangerDialog } from '@/components/features/admin/ConfirmDangerDialog';
import { Button } from '@/components/ui/button';
import type { OscarNominationDetailDto } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award } from 'lucide-react';

type Props = { row: OscarNominationDetailDto };

export const AwardOscarButton = ({ row }: Props) => {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => awardOscar(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oscars'] });
    },
  });

  if (row.isWinner) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-star)]">
        <Award className="h-3.5 w-3.5" />
        Награждена
      </span>
    );
  }

  return (
    <ConfirmDangerDialog
      trigger={
        <Button size="sm" variant="default" disabled={mutation.isPending}>
          Присудить
        </Button>
      }
      title="Присудить награду?"
      description={
        <>
          Это начислит +200 рейтинга персонажу <strong>{row.personName ?? '—'}</strong> и +500 —
          компании <strong>{row.companyName ?? '—'}</strong>. Действие необратимо.
        </>
      }
      confirmLabel="Присудить"
      variant="default"
      isLoading={mutation.isPending}
      onConfirm={() => mutation.mutateAsync()}
    />
  );
};
