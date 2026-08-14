import { getCompanyById } from '@/api/companies';
import {
  type ContractActionParams,
  breakContract,
  confirmContract,
  confirmContractEnd,
  rejectContract,
  rejectContractEnd,
  requestContractEnd,
} from '@/api/contracts';
import { ContractScansSection } from '@/components/features/scans/ContractScansSection';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { NoticeBox } from '@/components/ui/notice-box';
import { SectionLabel } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  BRANCH_LABELS,
  BREAKUP_PENALTY_PERCENT_REGULAR,
  BREAKUP_PENALTY_PERCENT_STAR,
  type ContractDto,
  type ContractStatusCode,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { ContractStatusBadge } from './ContractStatusBadge';

type Props = {
  contract: ContractDto;
};

type ActionKey = 'confirm' | 'reject' | 'break' | 'requestEnd' | 'confirmEnd' | 'rejectEnd';

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

const KIND_LABELS = {
  permanent: 'Постоянный',
  temporary: 'Временный',
} as const;

/** Надзаголовок карточки: чем контракт является для игрока прямо сейчас. */
const STAGE_LABELS: Record<ContractStatusCode, string> = {
  draft: 'Черновик',
  sent: 'Предложение',
  confirmed: 'Действующий',
  rejected: 'Отклонено',
  breakup_sent: 'Запрос на разрыв',
  breakup_confirmed: 'Расторгнут',
  breakup_rejected: 'Разрыв отклонён',
  broken_company: 'Разорван компанией',
  broken_person: 'Разорван вами',
};

const Meta = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <dt className="text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-[var(--color-subtle-fg)]">
      {label}
    </dt>
    <dd
      className={cn(
        'mt-1.5 text-[12.5px] font-bold',
        mono && 'font-[family-name:var(--font-mono)] tabular-nums',
      )}
    >
      {value}
    </dd>
  </div>
);

export const ContractCard = ({ contract }: Props) => {
  const qc = useQueryClient();
  const [action, setAction] = useState<ActionKey | null>(null);

  const { data: company } = useQuery({
    queryKey: ['companies', contract.companyId],
    queryFn: () => getCompanyById(contract.companyId),
    staleTime: 5 * 60_000,
  });

  const params: ContractActionParams = { kind: contract.kind, id: contract.id };

  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ['contracts', 'my'] });
    setAction(null);
  };

  const mutations = {
    confirm: useMutation({ mutationFn: confirmContract, onSuccess }),
    reject: useMutation({ mutationFn: rejectContract, onSuccess }),
    break: useMutation({ mutationFn: breakContract, onSuccess }),
    requestEnd: useMutation({ mutationFn: requestContractEnd, onSuccess }),
    confirmEnd: useMutation({ mutationFn: confirmContractEnd, onSuccess }),
    rejectEnd: useMutation({ mutationFn: rejectContractEnd, onSuccess }),
  } as const;

  const isPending = action ? mutations[action].isPending : false;

  const runAction = (comment?: string) => {
    if (!action) return;
    mutations[action].mutate({ ...params, ...(comment ? { comment } : {}) });
  };

  const showActions = ['sent', 'breakup_sent', 'confirmed', 'breakup_rejected'].includes(
    contract.statusCode,
  );
  // Отвечать на запрос о расторжении может только противоположная сторона.
  const canAnswerBreakup =
    contract.statusCode === 'breakup_sent' && contract.breakupInitiatedBy !== 'person';
  const canBreakUnilaterally =
    contract.kind === 'permanent' &&
    ['confirmed', 'breakup_rejected'].includes(contract.statusCode);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel className="font-[family-name:var(--font-mono)] tracking-[0.16em]">
            {STAGE_LABELS[contract.statusCode]}
          </SectionLabel>
          <CardTitle className="mt-1.5 truncate text-xl">{company?.name ?? 'Компания…'}</CardTitle>
          {company && (
            <p className="mt-1 truncate text-[11.5px] text-[var(--color-subtle-fg)]">
              {BRANCH_LABELS[company.branchCode]}
            </p>
          )}
        </div>
        <ContractStatusBadge status={contract.statusCode} />
      </div>

      <dl className="mt-4 flex flex-wrap gap-5 border-t border-[var(--color-hairline)] pt-4">
        <Meta label="Тип" value={KIND_LABELS[contract.kind]} />
        <Meta label="Начало" value={formatDate(contract.startedAt)} mono />
        {contract.endedAt && <Meta label="Окончание" value={formatDate(contract.endedAt)} mono />}
      </dl>

      {contract.statusCode === 'sent' && contract.kind === 'permanent' && (
        <NoticeBox tone="danger" className="mt-4">
          Подтверждение разорвёт текущий постоянный контракт со штрафом: Звезда теряет{' '}
          {BREAKUP_PENALTY_PERCENT_STAR}% постоянного рейтинга, обычная персона —{' '}
          {BREAKUP_PENALTY_PERCENT_REGULAR}%.
        </NoticeBox>
      )}

      {showActions && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {contract.statusCode === 'sent' && (
            <>
              <Button className="flex-1" onClick={() => setAction('confirm')}>
                Подтвердить
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setAction('reject')}>
                Отклонить
              </Button>
            </>
          )}
          {canAnswerBreakup && (
            <>
              <Button className="flex-1" onClick={() => setAction('confirmEnd')}>
                Подтвердить разрыв
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setAction('rejectEnd')}>
                Отклонить
              </Button>
            </>
          )}
          {contract.statusCode === 'confirmed' && (
            <Button className="flex-1" variant="outline" onClick={() => setAction('requestEnd')}>
              Предложить расторжение
            </Button>
          )}
          {canBreakUnilaterally && (
            <Button className="flex-1" variant="destructive" onClick={() => setAction('break')}>
              Разорвать
            </Button>
          )}
        </div>
      )}

      <ContractScansSection
        contract={{ kind: contract.kind, id: contract.id }}
        companyId={contract.companyId}
        canUpload={false}
      />

      <ConfirmActionDialog
        open={action === 'confirm'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Подтвердить контракт"
        description={`Вы подтверждаете контракт с компанией ${company?.name ?? ''}.`}
        confirmLabel="Подтвердить"
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'reject'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Отклонить предложение"
        description="Вы уверены, что хотите отклонить предложение?"
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
            Вы разрываете постоянный контракт в одностороннем порядке. Штраф уйдёт в пользу
            компании: Звезда теряет <strong>{BREAKUP_PENALTY_PERCENT_STAR}%</strong> постоянного
            рейтинга, обычная персона — <strong>{BREAKUP_PENALTY_PERCENT_REGULAR}%</strong>.
          </span>
        }
        confirmLabel="Разорвать"
        tone="destructive"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'requestEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Предложить расторжение"
        description="Компания получит запрос на расторжение по обоюдному согласию. Штраф в этом случае не начисляется."
        confirmLabel="Отправить"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'confirmEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Подтвердить расторжение"
        description="Вы согласны на расторжение контракта по инициативе компании."
        confirmLabel="Подтвердить"
        isPending={isPending}
        onConfirm={runAction}
      />
      <ConfirmActionDialog
        open={action === 'rejectEnd'}
        onOpenChange={(v) => !v && setAction(null)}
        title="Отклонить расторжение"
        description="Вы отказываетесь от расторжения. Компания сможет принять решение об одностороннем разрыве со штрафом."
        confirmLabel="Отклонить"
        tone="destructive"
        withComment
        isPending={isPending}
        onConfirm={runAction}
      />
    </Card>
  );
};
