import {
  type CompanyContractActionParams,
  breakCompanyContract,
  confirmEndCompanyContract,
  rejectEndCompanyContract,
  requestEndCompanyContract,
  submitCompanyContract,
} from '@/api/contracts';
import { ConfirmActionDialog } from '@/components/features/contracts/ConfirmActionDialog';
import { ContractStatusBadge } from '@/components/features/contracts/ContractStatusBadge';
import { ContractScansSection } from '@/components/features/scans/ContractScansSection';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ContractDto } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type Props = {
  contract: ContractDto;
  companyId: string;
  personName?: string;
};

type ActionKey = 'submit' | 'break' | 'requestEnd' | 'confirmEnd' | 'rejectEnd';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

const KIND_LABELS = {
  permanent: 'Постоянный',
  temporary: 'Временный',
} as const;

export const CompanyContractCard = ({ contract, companyId, personName }: Props) => {
  const qc = useQueryClient();
  const [action, setAction] = useState<ActionKey | null>(null);

  const params: CompanyContractActionParams = {
    companyId,
    kind: contract.kind,
    id: contract.id,
  };

  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ['contracts', 'company', companyId] });
    setAction(null);
  };

  const mutations = {
    submit: useMutation({ mutationFn: submitCompanyContract, onSuccess }),
    break: useMutation({ mutationFn: breakCompanyContract, onSuccess }),
    requestEnd: useMutation({ mutationFn: requestEndCompanyContract, onSuccess }),
    confirmEnd: useMutation({ mutationFn: confirmEndCompanyContract, onSuccess }),
    rejectEnd: useMutation({ mutationFn: rejectEndCompanyContract, onSuccess }),
  } as const;

  const isPending = action ? mutations[action].isPending : false;

  const runAction = (comment?: string) => {
    if (!action) return;
    mutations[action].mutate({ ...params, ...(comment ? { comment } : {}) });
  };

  // Отвечать на запрос о расторжении может только противоположная сторона.
  const canAnswerBreakup =
    contract.statusCode === 'breakup_sent' && contract.breakupInitiatedBy !== 'company';
  const canBreakUnilaterally = ['confirmed', 'breakup_rejected'].includes(contract.statusCode);
  const showActions = contract.statusCode === 'draft' || canAnswerBreakup || canBreakUnilaterally;

  // Запрос на разрыв от персонажа в макете выделен красной рамкой — он требует решения компании.
  const needsAttention = canAnswerBreakup;

  return (
    <Card
      className={cn(
        'p-4',
        needsAttention && 'border-[color-mix(in_oklab,var(--color-destructive)_35%,transparent)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{personName ?? 'Персонаж…'}</div>
          <p className="mt-1.5 truncate text-[11px] text-[var(--color-subtle-fg)]">
            {KIND_LABELS[contract.kind]} · {formatDate(contract.startedAt)}
            {contract.endedAt ? ` — ${formatDate(contract.endedAt)}` : ''}
          </p>
        </div>
        <ContractStatusBadge status={contract.statusCode} />
      </div>

      {showActions && (
        <div className="mt-3.5 flex gap-2">
          {contract.statusCode === 'draft' && (
            <Button className="flex-1" size="sm" onClick={() => setAction('submit')}>
              Отправить персонажу
            </Button>
          )}
          {canAnswerBreakup && (
            <>
              <Button className="flex-1" size="sm" onClick={() => setAction('confirmEnd')}>
                Подтвердить разрыв
              </Button>
              <Button
                className="flex-1"
                size="sm"
                variant="outline"
                onClick={() => setAction('rejectEnd')}
              >
                Отклонить
              </Button>
            </>
          )}
          {contract.statusCode === 'confirmed' && (
            <Button
              className="flex-1"
              size="sm"
              variant="outline"
              onClick={() => setAction('requestEnd')}
            >
              На разрыв
            </Button>
          )}
          {canBreakUnilaterally && (
            <Button
              className="flex-1"
              size="sm"
              variant="destructive"
              onClick={() => setAction('break')}
            >
              Разорвать
            </Button>
          )}
        </div>
      )}

      <ContractScansSection
        contract={{ kind: contract.kind, id: contract.id }}
        companyId={companyId}
        canUpload
      />

      <ConfirmActionDialog
        open={action === 'submit'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Отправить контракт персонажу"
        description={`Персонаж ${personName ?? ''} получит предложение и сможет подтвердить или отклонить его.`}
        confirmLabel="Отправить"
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'requestEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Запросить расторжение"
        description="Персонаж должен подтвердить расторжение."
        confirmLabel="Отправить запрос"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'confirmEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Подтвердить расторжение"
        description={`Компания соглашается расторгнуть контракт по инициативе персонажа ${personName ?? ''}.`}
        confirmLabel="Подтвердить"
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'rejectEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Отклонить расторжение"
        description="Контракт продолжит действовать. Персонаж сможет разорвать его в одностороннем порядке со штрафом."
        confirmLabel="Отклонить"
        tone="destructive"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'break'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Односторонний разрыв"
        warning={
          <span>
            Компания разрывает контракт без согласия персонажа. Это действие нельзя отменить.
          </span>
        }
        confirmLabel="Разорвать"
        tone="destructive"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
    </Card>
  );
};
