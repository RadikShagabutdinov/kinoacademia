import { admire, getMyRating } from '@/api/ratings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NoticeBox } from '@/components/ui/notice-box';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { meQueryOptions, useMe } from '@/hooks/useMe';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { formatAmount } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { PersonRatingDto } from '@kinoacademia/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Minus, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

// Множитель Звезды применяет сервер: он же решает, кто Звезда на момент перевода.
// Клиент считает то же число только ради предпросмотра «сколько получит адресат».
const STAR_MULTIPLIER = 5;

const myRatingQueryOptions = queryOptions<PersonRatingDto>({
  queryKey: ['ratings', 'me'],
  queryFn: getMyRating,
  staleTime: 15_000,
});

export const Route = createFileRoute('/_auth/admire')({
  component: AdmirePage,
});

function AdmirePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: rating } = useQuery(myRatingQueryOptions);
  const { data: persons = [] } = useOpenPersons();

  const [query, setQuery] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState(1);

  const meId = me?.person?.id;
  const available = rating?.generated ?? 0;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return persons
      .filter((p) => p.id !== meId)
      .filter((p) => (q ? p.displayName.toLowerCase().includes(q) : true))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [persons, meId, query]);

  const recipient = persons.find((p) => p.id === recipientId);

  // Бонус ×5 — свойство отправителя, статус получателя на сумму не влияет.
  const bonusApplies = Boolean(rating?.isStar);
  const credited = amount * (bonusApplies ? STAR_MULTIPLIER : 1);
  const canSend = recipientId !== '' && amount > 0 && amount <= available;

  const mutation = useMutation({
    mutationFn: admire,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ratings', 'me'] });
      qc.invalidateQueries({ queryKey: ['ratings', 'me', 'history'] });
      qc.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      navigate({ to: '/my-rating' });
    },
  });

  if (!me?.person) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Персонаж не назначен</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Восхищение доступно только персонажам игры.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Выразить восхищение" backTo="/" />

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
        <SectionLabel>Переменный рейтинг</SectionLabel>
        <div className="mt-2 flex items-end gap-3">
          <DisplayNumber size="lg" className="text-[var(--color-star)]">
            {formatAmount(available)}
          </DisplayNumber>
          <span className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted-fg)]">
            единиц можно
            <br />
            раздать
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle-fg)]">
          Переменный рейтинг нельзя перевести себе. Остаток обнуляется по расписанию игры.
        </p>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Кому</SectionLabel>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtle-fg)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Имя персонажа"
            className="pl-9"
            aria-label="Поиск персонажа"
          />
        </div>

        <ul className="max-h-64 space-y-1.5 overflow-auto">
          {candidates.length === 0 && (
            <li className="px-1 py-3 text-xs text-[var(--color-subtle-fg)]">Никого не нашлось.</li>
          )}
          {candidates.map((p) => {
            const selected = p.id === recipientId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setRecipientId(p.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition-colors',
                    selected
                      ? 'border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-muted-fg)]',
                  )}
                >
                  <span
                    className="font-[family-name:var(--font-display)] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-black"
                    aria-hidden
                  >
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.displayName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <SectionLabel>Сколько списать</SectionLabel>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Уменьшить"
            onClick={() => setAmount((v) => Math.max(1, v - 1))}
            disabled={amount <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <DisplayNumber size="md">{amount}</DisplayNumber>
            <SectionLabel className="mt-1">единиц</SectionLabel>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Увеличить"
            onClick={() => setAmount((v) => Math.min(available, v + 1))}
            disabled={amount >= available}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {bonusApplies && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_oklab,var(--color-star)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-star)_9%,transparent)] px-3.5 py-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-star)]">
              <Star className="h-3.5 w-3.5 fill-current" />
              Бонус Звезды ×{STAR_MULTIPLIER}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums text-[var(--color-star)]">
              +{credited}
            </span>
          </div>
        )}

        {amount > available && (
          <NoticeBox tone="danger" className="mt-4">
            Столько переменного рейтинга у вас нет — доступно {available}.
          </NoticeBox>
        )}

        {mutation.isError && (
          <NoticeBox tone="danger" className="mt-4">
            Не удалось перевести: {(mutation.error as Error)?.message ?? 'попробуйте ещё раз'}
          </NoticeBox>
        )}

        <Button
          size="xl"
          className="mt-4"
          disabled={!canSend || mutation.isPending}
          onClick={() => mutation.mutate({ recipientPersonId: recipientId, amount })}
        >
          {mutation.isPending
            ? 'Передаём…'
            : recipient
              ? `Отправить ${credited} · ${recipient.displayName}`
              : 'Выберите получателя'}
        </Button>
      </section>
    </div>
  );
}
