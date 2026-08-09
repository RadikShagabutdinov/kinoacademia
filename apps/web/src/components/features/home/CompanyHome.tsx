import { getCompanyContracts } from '@/api/contracts';
import { listCompanyOscars } from '@/api/oscars';
import { getCompanyRating } from '@/api/ratings';
import { ContractStatusBadge } from '@/components/features/contracts/ContractStatusBadge';
import { MetricBar } from '@/components/ui/metric-bar';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { formatAmount } from '@/lib/tone';
import {
  BRANCH_LABELS,
  type CompanyDto,
  type ContractDto,
  NOMINATION_LABELS,
} from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Award, Clapperboard, FilePlus2 } from 'lucide-react';

type Props = { company: CompanyDto };

/** Статусы, в которых контракт ждёт решения — из них собирается блок «Требуют внимания». */
const NEEDS_ATTENTION: ReadonlySet<ContractDto['statusCode']> = new Set(['sent', 'breakup_sent']);

export const CompanyHome = ({ company }: Props) => {
  const { data: ratingData } = useQuery({
    queryKey: ['ratings', 'company', company.id],
    queryFn: () => getCompanyRating(company.id),
    staleTime: 15_000,
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'company', company.id],
    queryFn: () => getCompanyContracts(company.id),
    staleTime: 15_000,
  });
  const { data: nominations = [] } = useQuery({
    queryKey: ['oscars', 'company', company.id],
    queryFn: () => listCompanyOscars(company.id),
    staleTime: 30_000,
    enabled: company.branchCode === 'cinema',
  });

  // ContractDto содержит только personId — имена берём из общего справочника
  // открытых персонажей, как это делает страница контрактов компании.
  const { data: persons = [] } = useOpenPersons();
  const personNames = new Map(persons.map((p) => [p.id, p.displayName]));

  const rating = ratingData?.rating;
  const isCinema = company.branchCode === 'cinema';
  const pending = contracts.filter((c) => NEEDS_ATTENTION.has(c.statusCode));

  const rows = rating
    ? [
        { label: 'Капитализация', value: rating.employeePermanent },
        { label: 'Ручные', value: rating.manualTopup },
        { label: 'Оскар', value: rating.oscar },
        { label: 'Штрафы', value: rating.penalties },
      ]
    : [];
  const permanentTotal = rows.reduce((sum, r) => sum + r.value, 0);
  const maxRow = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
        <SectionLabel>{BRANCH_LABELS[company.branchCode]}</SectionLabel>
        <div className="font-[family-name:var(--font-display)] mt-2 text-[26px] font-black leading-none">
          {company.name}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <SectionLabel>Рейтинг компании</SectionLabel>
            <DisplayNumber size="lg" className="mt-1.5 text-[var(--color-accent)]">
              {formatAmount(permanentTotal)}
            </DisplayNumber>
          </div>
          <div className="text-right">
            <SectionLabel>Бюджет</SectionLabel>
            <DisplayNumber className="mt-1.5">{formatAmount(rating?.budget ?? 0)}</DisplayNumber>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="mt-5 flex flex-col gap-2.5 border-t border-[var(--color-hairline)] pt-4">
            {rows.map((r) => (
              <MetricBar key={r.label} label={r.label} value={r.value} max={maxRow} />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <TileLink to="/company/contracts" icon={FilePlus2} label="Предложить контракт" accent />
        {isCinema && <TileLink to="/company/films" icon={Clapperboard} label="Заявить фильм" />}
        {isCinema && <TileLink to="/company/oscar-nominations" icon={Award} label="Номинировать" />}
      </div>

      {(pending.length > 0 || nominations.length > 0) && (
        <section>
          <SectionLabel className="mb-2.5">Требуют внимания</SectionLabel>
          <ul className="flex flex-col gap-2">
            {pending.map((c) => (
              <li
                key={`${c.kind}-${c.id}`}
                className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {personNames.get(c.personId) ?? 'Персонаж'}
                  </div>
                  <div className="truncate text-[11px] text-[var(--color-subtle-fg)]">
                    {c.kind === 'permanent' ? 'Постоянный' : 'Временный'}
                  </div>
                </div>
                <ContractStatusBadge status={c.statusCode} />
              </li>
            ))}
            {nominations
              .filter((n) => !n.isWinner)
              .slice(0, 3)
              .map((n) => (
                <li
                  key={n.id}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">
                      Оскар · {NOMINATION_LABELS[n.nominationCode]}
                    </div>
                    <div className="truncate text-[11px] text-[var(--color-subtle-fg)]">
                      {n.filmTitle ?? '—'}
                      {n.personName ? ` · ${n.personName}` : ''}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
};

type TileProps = {
  to: string;
  icon: typeof Award;
  label: string;
  accent?: boolean;
};

const TileLink = ({ to, icon: Icon, label, accent }: TileProps) => (
  <Link
    to={to}
    className="flex flex-col gap-2.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-accent)]"
  >
    <Icon
      className="h-5 w-5"
      style={{ color: accent ? 'var(--color-accent)' : 'var(--color-muted-fg)' }}
    />
    <span className="text-sm font-bold leading-tight">{label}</span>
  </Link>
);
