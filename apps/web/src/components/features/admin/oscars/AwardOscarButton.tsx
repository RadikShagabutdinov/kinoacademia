import { awardOscar } from '@/api/oscars';
import { ConfirmDangerDialog } from '@/components/features/admin/ConfirmDangerDialog';
import { Button } from '@/components/ui/button';
import {
  NOMINATION_LABELS,
  OSCAR_NOMINEE_BONUS,
  OSCAR_WIN_COMPANY_BONUS,
  OSCAR_WIN_PERSON_BONUS,
  type OscarNominationDetailDto,
  isCinemaOnlyNomination,
} from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award } from 'lucide-react';

type Props = {
  row: OscarNominationDetailDto;
  /** В этой номинации уже есть победитель — присуждать больше некому. */
  nominationClosed?: boolean;
};

export const AwardOscarButton = ({ row, nominationClosed = false }: Props) => {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => awardOscar(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oscars'] });
      qc.invalidateQueries({ queryKey: ['ratings'] });
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

  if (nominationClosed) {
    return <span className="text-xs text-[var(--color-muted-fg)]">Номинация уже присуждена</span>;
  }

  const isCinema = isCinemaOnlyNomination(row.nominationCode);

  return (
    <ConfirmDangerDialog
      trigger={
        <Button size="sm" variant="default" disabled={mutation.isPending}>
          Присудить
        </Button>
      }
      title="Присудить награду?"
      description={
        isCinema ? (
          <>
            Персонаж <strong>{row.personName ?? '—'}</strong> получит +{OSCAR_WIN_PERSON_BONUS}{' '}
            постоянного рейтинга. Компания <strong>{row.companyName ?? '—'}</strong> получит ещё +
            {OSCAR_WIN_COMPANY_BONUS}, если у победителя есть контракт с ней. Номинация «
            {NOMINATION_LABELS[row.nominationCode]}» закроется: все остальные её номинанты получат
            по +{OSCAR_NOMINEE_BONUS} постоянного рейтинга. Действие необратимо.
          </>
        ) : (
          <>
            Персонаж <strong>{row.personName ?? '—'}</strong> получит статуэтку без начислений
            рейтинга — рейтинг за закрытую номинацию начисляется вручную. Действие необратимо.
          </>
        )
      }
      confirmLabel="Присудить"
      variant="default"
      isLoading={mutation.isPending}
      onConfirm={() => mutation.mutateAsync()}
    />
  );
};
