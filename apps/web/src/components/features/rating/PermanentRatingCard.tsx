import { MetricBar } from '@/components/ui/metric-bar';
import { NoticeBox } from '@/components/ui/notice-box';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { formatAmount } from '@/lib/tone';
import {
  type PersonRatingDto,
  STAR_RATING_FULL,
  STAR_RATING_WITH_CONTRACT,
} from '@kinoacademia/shared';

type Props = {
  rating: PersonRatingDto;
};

export const PermanentRatingCard = ({ rating }: Props) => {
  const rows = [
    { label: 'База', value: rating.base, color: 'var(--color-chart-1)' },
    { label: 'Восхищение', value: rating.systemTopup, color: 'var(--color-success)' },
    { label: 'Ручные', value: rating.manualTopup, color: 'var(--color-muted-fg)' },
    { label: 'Оскар', value: rating.oscar, color: 'var(--color-accent)' },
    { label: 'Штрафы', value: rating.penalties, color: 'var(--color-destructive)' },
    // Ручные начисления показываем только когда они есть — в макете этой строки нет,
    // но скрывать реальные баллы нельзя.
  ].filter((r) => r.label !== 'Ручные' || r.value !== 0);

  const maxRow = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Постоянный</SectionLabel>
        <DisplayNumber className="text-[var(--color-accent)]">
          {formatAmount(rating.nowPermanent)}
        </DisplayNumber>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => (
          <MetricBar key={r.label} label={r.label} value={r.value} max={maxRow} color={r.color} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--color-subtle-fg)]">
        <span>Прошлый период</span>
        <span className="font-[family-name:var(--font-mono)] font-bold tabular-nums">
          {formatAmount(rating.lastPermanent)}
        </span>
      </div>

      <NoticeBox tone={rating.isStar ? 'star' : 'muted'} className="mt-4">
        {rating.isStar
          ? `★ Статус Звезды удержан: рейтинг ≥ ${STAR_RATING_FULL} либо ≥ ${STAR_RATING_WITH_CONTRACT} с постоянным контрактом`
          : `До статуса Звезды: рейтинг ≥ ${STAR_RATING_FULL}, либо ≥ ${STAR_RATING_WITH_CONTRACT} с действующим постоянным контрактом`}
      </NoticeBox>
    </section>
  );
};
