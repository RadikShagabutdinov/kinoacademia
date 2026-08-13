import { MetricBar } from '@/components/ui/metric-bar';
import { NoticeBox } from '@/components/ui/notice-box';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { formatAmount } from '@/lib/tone';
import { CAPITALIZATION_PER_EMPLOYEE_CAP, type CompanyRatingDto } from '@kinoacademia/shared';

type Props = {
  rating: CompanyRatingDto;
};

export const CompanyRatingCard = ({ rating }: Props) => {
  const rows = [
    {
      label: 'Капитализация',
      value: rating.employeePermanent,
      color: 'var(--color-chart-1)',
    },
    { label: 'Ручные', value: rating.manualTopup, color: 'var(--color-muted-fg)' },
    { label: 'Оскар', value: rating.oscar, color: 'var(--color-accent)' },
    { label: 'Штрафы', value: rating.penalties, color: 'var(--color-destructive)' },
  ];

  const maxRow = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <SectionLabel>Рейтинг компании</SectionLabel>
          <DisplayNumber size="lg" className="mt-1.5 text-[var(--color-accent)]">
            {formatAmount(rating.nowPermanent)}
          </DisplayNumber>
        </div>
        <div className="text-right">
          <SectionLabel>Бюджет</SectionLabel>
          <DisplayNumber className="mt-1.5">{formatAmount(rating.budget)}</DisplayNumber>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5 border-t border-[var(--color-hairline)] pt-4">
        {rows.map((r) => (
          <MetricBar key={r.label} label={r.label} value={r.value} max={maxRow} color={r.color} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--color-subtle-fg)]">
        <span>Прошлое значение</span>
        <span className="font-[family-name:var(--font-mono)] font-bold tabular-nums">
          {formatAmount(rating.lastPermanent)}
        </span>
      </div>

      <NoticeBox className="mt-4">
        Бюджет — аналог переменного рейтинга: им распоряжается администратор, автоматически он не
        обнуляется. Капитализация растёт дважды в сутки: каждый сотрудник на постоянном контракте
        приносит компании свой постоянный рейтинг, но не более {CAPITALIZATION_PER_EMPLOYEE_CAP}{' '}
        пунктов за начисление. Изменения рейтинга сотрудников отражаются на компании сразу.
      </NoticeBox>
    </section>
  );
};
