import { getMyRating, getPersonRatingSummary } from '@/api/ratings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricBar } from '@/components/ui/metric-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { useMe } from '@/hooks/useMe';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { formatAmount, formatSigned, signedTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { PersonRatingDto } from '@kinoacademia/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

const myRatingQueryOptions = queryOptions<PersonRatingDto>({
  queryKey: ['ratings', 'me'],
  queryFn: getMyRating,
  staleTime: 15_000,
});

export const Route = createFileRoute('/_auth/compare')({
  component: ComparePage,
});

function ComparePage() {
  const { data: me } = useMe();
  const { data: rating } = useQuery({ ...myRatingQueryOptions, enabled: Boolean(me?.person) });
  const { data: persons = [] } = useOpenPersons();
  const [selectedId, setSelectedId] = useState('');

  const meId = me?.person?.id;

  const candidates = useMemo(
    () =>
      persons
        .filter((p) => p.id !== meId)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [persons, meId],
  );
  const other = candidates.find((p) => p.id === selectedId);

  const { data: otherSummary, isFetching } = useQuery({
    queryKey: ['ratings', 'person', selectedId, 'summary'],
    queryFn: () => getPersonRatingSummary(selectedId),
    enabled: Boolean(selectedId),
  });

  if (!me?.person) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Персонаж не назначен</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Встречная проверка доступна только персонажам игры.
        </CardContent>
      </Card>
    );
  }

  const mine = rating?.nowPermanent ?? 0;
  const theirs = otherSummary?.nowPermanent ?? 0;
  const diff = mine - theirs;

  const rows = rating
    ? [
        { label: 'База', value: rating.base },
        { label: 'Восхищение', value: rating.systemTopup },
        { label: 'Ручные', value: rating.manualTopup },
        { label: 'Оскар', value: rating.oscar },
        { label: 'Штрафы', value: rating.penalties },
      ]
    : [];
  const maxRow = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="Встречная проверка"
        backTo="/"
        description="Сравнение видно только вам. Один персонаж за раз."
      />

      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger aria-label="Персонаж для сравнения">
          <SelectValue placeholder="— выберите персонажа —" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedId && (
        <>
          <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <SideCard
              name={me.person.displayName}
              caption="Вы"
              value={mine}
              isStar={rating?.isStar ?? false}
            />
            <span className="font-[family-name:var(--font-display)] text-sm font-black text-[var(--color-subtle-fg)]">
              VS
            </span>
            <SideCard
              name={other?.displayName ?? 'Персонаж'}
              caption="Соперник"
              value={isFetching ? null : theirs}
              isStar={otherSummary?.isStar ?? false}
            />
          </section>

          {!isFetching && (
            <div
              className={cn(
                'rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-center text-sm font-bold',
                signedTone(diff),
              )}
            >
              Разница {formatSigned(diff)}
              <span className="ml-1.5 font-semibold text-[var(--color-subtle-fg)]">
                {diff === 0 ? 'ровно' : diff > 0 ? 'в вашу пользу' : 'не в вашу пользу'}
              </span>
            </div>
          )}
        </>
      )}

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <SectionLabel>Ваши составляющие</SectionLabel>
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((r) => (
            <MetricBar key={r.label} label={r.label} value={r.value} max={maxRow} />
          ))}
        </div>
        {/* Разбивка чужого рейтинга намеренно не раскрывается: эндпоинт summary
            отдаёт только итог, чтобы составляющие оставались приватными. */}
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-subtle-fg)]">
          Составляющие других персонажей закрыты — по ним доступен только итоговый рейтинг.
        </p>
      </section>
    </div>
  );
}

type SideCardProps = {
  name: string;
  caption: string;
  value: number | null;
  isStar: boolean;
};

const SideCard = ({ name, caption, value, isStar }: SideCardProps) => (
  <div className="min-w-0 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
    <div className="truncate text-sm font-bold">{name}</div>
    <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-[var(--color-subtle-fg)]">
      {caption}
    </div>
    <DisplayNumber size="sm" className="mt-2.5 text-[var(--color-accent)]">
      {value === null ? '…' : formatAmount(value)}
    </DisplayNumber>
    {isStar && (
      <Badge variant="star" className="mt-2">
        ★
      </Badge>
    )}
  </div>
);
