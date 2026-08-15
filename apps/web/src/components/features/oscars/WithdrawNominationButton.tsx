import { withdrawNomination } from '@/api/oscars';
import { ConfirmDangerDialog } from '@/components/features/admin/ConfirmDangerDialog';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiError';
import type { OscarNominationDetailDto } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type Props = {
  row: OscarNominationDetailDto;
  /** Сколько вернётся в бюджет — считается вызывающим по числу номинаций компании. */
  refund: number;
};

export const WithdrawNominationButton = ({ row, refund }: Props) => {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => withdrawNomination(row.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oscars'] });
      if (row.companyId) {
        qc.invalidateQueries({ queryKey: ['ratings', 'company', row.companyId] });
      }
    },
  });

  // Победившую номинацию отзывать нельзя — сервер отдаёт 409, кнопку не показываем.
  if (row.isWinner) return null;

  return (
    <div className="space-y-1">
      <ConfirmDangerDialog
        trigger={
          <Button size="sm" variant="outline" disabled={mutation.isPending}>
            Отозвать
          </Button>
        }
        title="Отозвать номинацию?"
        description={
          <>
            Номинация будет удалена
            {refund > 0 ? (
              <>
                , в бюджет компании вернётся <strong>{refund}</strong> рейтинга
              </>
            ) : (
              ' (возврата не будет — эта номинация бесплатная)'
            )}
            .
          </>
        }
        confirmLabel="Отозвать"
        isLoading={mutation.isPending}
        onConfirm={() => mutation.mutateAsync().catch(() => undefined)}
      />
      {mutation.isError && (
        <p className="text-xs text-[var(--color-destructive)]">
          {getApiErrorMessage(mutation.error, 'Не удалось отозвать номинацию')}
        </p>
      )}
    </div>
  );
};
