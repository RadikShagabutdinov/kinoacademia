import {
  companiesQueryOptions,
  createCompanyPayment,
  myCompanyQueryOptions,
} from '@/api/companies';
import { type CompanyRatingResponse, getCompanyRating } from '@/api/ratings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NoticeBox } from '@/components/ui/notice-box';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { formatAmount } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { BRANCH_LABELS } from '@kinoacademia/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type RecipientKind = 'person' | 'company';

const companyRatingQueryOptions = (companyId: string) =>
  queryOptions<CompanyRatingResponse>({
    queryKey: ['ratings', 'company', companyId],
    queryFn: () => getCompanyRating(companyId),
    staleTime: 15_000,
  });

export const Route = createFileRoute('/_auth/company/payments')({
  component: CompanyPaymentsPage,
});

function CompanyPaymentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: company } = useQuery(myCompanyQueryOptions);
  const { data: ratingData } = useQuery({
    ...companyRatingQueryOptions(company?.id ?? ''),
    enabled: Boolean(company),
  });
  const { data: persons = [] } = useOpenPersons();
  const { data: companies = [] } = useQuery(companiesQueryOptions);

  const [kind, setKind] = useState<RecipientKind>('person');
  const [query, setQuery] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');

  const budget = ratingData?.rating.budget ?? 0;
  const parsedAmount = Number.parseInt(amount, 10);
  const value = Number.isFinite(parsedAmount) ? parsedAmount : 0;

  // Свою компанию из списка убираем: платить самой себе нельзя — это была бы
  // бесплатная конвертация бюджета в собственный рейтинг.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows =
      kind === 'person'
        ? persons.map((p) => ({ id: p.id, name: p.displayName, note: '' }))
        : companies
            .filter((c) => c.id !== company?.id)
            .map((c) => ({ id: c.id, name: c.name, note: BRANCH_LABELS[c.branchCode] }));
    return rows
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [kind, persons, companies, company?.id, query]);

  const recipient = candidates.find((r) => r.id === recipientId);
  const canSend = Boolean(company) && recipientId !== '' && value > 0 && value <= budget;

  const mutation = useMutation({
    mutationFn: () =>
      createCompanyPayment(company?.id ?? '', {
        ...(kind === 'person'
          ? { recipientPersonId: recipientId }
          : { recipientCompanyId: recipientId }),
        amount: value,
      }),
    onSuccess: () => {
      if (company) qc.invalidateQueries({ queryKey: ['ratings', 'company', company.id] });
      qc.invalidateQueries({ queryKey: ['ratings', 'me'] });
      navigate({ to: '/company/rating' });
    },
  });

  const switchKind = (next: RecipientKind) => {
    setKind(next);
    setRecipientId('');
    setQuery('');
  };

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Компания не назначена</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Дождитесь, пока администратор привяжет вас к компании.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Выплата из бюджета" backTo="/" description={company.name} />

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
        <SectionLabel>Бюджет компании</SectionLabel>
        <DisplayNumber size="lg" className="mt-2">
          {formatAmount(budget)}
        </DisplayNumber>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle-fg)]">
          Выплата уходит в постоянный рейтинг получателя и обратно не возвращается. Отменить её
          может только администратор.
        </p>
      </section>

      <section className="space-y-2.5">
        <SectionLabel>Кому</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {(['person', 'company'] as const).map((k) => (
            <Button
              key={k}
              variant={kind === k ? 'default' : 'outline'}
              onClick={() => switchKind(k)}
            >
              {k === 'person' ? 'Персонажу' : 'Компании'}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtle-fg)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'person' ? 'Имя персонажа' : 'Название компании'}
            className="pl-9"
            aria-label="Поиск получателя"
          />
        </div>

        <ul className="max-h-64 space-y-1.5 overflow-auto">
          {candidates.length === 0 && (
            <li className="px-1 py-3 text-xs text-[var(--color-subtle-fg)]">Никого не нашлось.</li>
          )}
          {candidates.map((r) => {
            const selected = r.id === recipientId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setRecipientId(r.id)}
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
                    {r.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.name}</span>
                    {r.note && (
                      <span className="block truncate text-[11px] text-[var(--color-subtle-fg)]">
                        {r.note}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <SectionLabel>Сколько выплатить</SectionLabel>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={budget}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-3"
          aria-label="Сумма выплаты"
        />

        {value > budget && (
          <NoticeBox tone="danger" className="mt-4">
            В бюджете столько нет — доступно {budget}.
          </NoticeBox>
        )}

        {mutation.isError && (
          <NoticeBox tone="danger" className="mt-4">
            Не удалось выплатить: {(mutation.error as Error)?.message ?? 'попробуйте ещё раз'}
          </NoticeBox>
        )}

        <Button
          size="xl"
          className="mt-4"
          disabled={!canSend || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? 'Выплачиваем…'
            : recipient
              ? `Выплатить ${value} · ${recipient.name}`
              : 'Выберите получателя'}
        </Button>
      </section>
    </div>
  );
}
