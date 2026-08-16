import { companiesQueryOptions } from '@/api/companies';
import { type ContractsHistoryFilter, getContractsHistory } from '@/api/contracts';
import { openPersonsQueryOptions } from '@/api/persons';
import { ContractStatusBadge } from '@/components/features/contracts/ContractStatusBadge';
import { InfoTable } from '@/components/features/info/InfoTable';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { MonoValue } from '@/components/ui/typography';
import {
  BRANCHES,
  BRANCH_LABELS,
  type BranchCode,
  type ContractKind,
  type ContractStatusCode,
  type ContractStatusHistoryDto,
} from '@kinoacademia/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';

const HISTORY_LIMIT = 200;

type KindFilter = ContractKind | 'all';

/** Статусы, означающие расторжение — по ним работает фильтр «Только разрывы». */
const BREAKUP_STATUSES: ReadonlySet<ContractStatusCode> = new Set([
  'breakup_sent',
  'breakup_confirmed',
  'breakup_rejected',
  'broken_company',
  'broken_person',
]);

const historyQueryOptions = (filter: ContractsHistoryFilter) =>
  queryOptions<ContractStatusHistoryDto[]>({
    queryKey: ['contracts', 'history', filter],
    queryFn: () => getContractsHistory({ ...filter, limit: HISTORY_LIMIT }),
    staleTime: 15_000,
  });

export const Route = createFileRoute('/_auth/info/contracts-history')({
  component: ContractsHistoryPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQueryOptions({})),
});

function ContractsHistoryPage() {
  const [companyId, setCompanyId] = useState<string>('');
  const [personId, setPersonId] = useState<string>('');
  const [branchCode, setBranchCode] = useState<BranchCode | ''>('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [breakupsOnly, setBreakupsOnly] = useState(false);

  const filter: ContractsHistoryFilter = useMemo(() => {
    const f: ContractsHistoryFilter = {};
    if (companyId) f.companyId = companyId;
    if (personId) f.personId = personId;
    if (branchCode) f.branchCode = branchCode;
    return f;
  }, [companyId, personId, branchCode]);

  const { data: rows = [] } = useQuery(historyQueryOptions(filter));
  // Полный неотфильтрованный набор — для счётчика и для имён, которых нет в справочниках.
  const { data: allRows = [] } = useQuery(historyQueryOptions({}));
  // Справочники — основной источник опций: истории может ещё не быть,
  // а выбрать компанию или персонажа нужно в любом случае.
  const { data: companies = [] } = useQuery(companiesQueryOptions);
  const { data: openPersons = [] } = useQuery(openPersonsQueryOptions);

  const companyOptions = useMemo(() => {
    const map = new Map<string, { name: string; branchCode: BranchCode }>();
    for (const c of companies) map.set(c.id, { name: c.name, branchCode: c.branchCode });
    // Компании из истории, которых нет в справочнике (например, системные), не теряем.
    for (const r of allRows) {
      if (!map.has(r.companyId)) {
        map.set(r.companyId, { name: r.companyName, branchCode: r.branchCode });
      }
    }
    return Array.from(map.entries())
      .filter(([, c]) => (branchCode ? c.branchCode === branchCode : true))
      .map(([id, c]) => ({ id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [companies, allRows, branchCode]);

  const personOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of openPersons) map.set(p.id, p.displayName);
    // `GET /persons` отдаёт только открытых — закрытых добираем из истории.
    for (const r of allRows) if (!map.has(r.personId)) map.set(r.personId, r.personDisplayName);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [openPersons, allRows]);

  const columns = useMemo<ColumnDef<ContractStatusHistoryDto>[]>(
    () => [
      {
        accessorKey: 'changedAt',
        header: 'Когда',
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-mono text-[11px]">
            {formatDateTime(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: 'personDisplayName',
        header: 'Персонаж',
        cell: ({ row }) => <span className="font-medium">{row.original.personDisplayName}</span>,
      },
      { accessorKey: 'companyName', header: 'Компания' },
      {
        accessorKey: 'contractKind',
        header: 'Тип',
        cell: ({ getValue }) => (getValue() === 'permanent' ? 'Постоянный' : 'Временный'),
      },
      {
        id: 'transition',
        header: 'Переход',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            {row.original.fromStatusCode ? (
              <ContractStatusBadge status={row.original.fromStatusCode} />
            ) : (
              <span className="text-[var(--color-muted-fg)]">—</span>
            )}
            <span className="text-[var(--color-muted-fg)]">→</span>
            <ContractStatusBadge status={row.original.toStatusCode} />
          </div>
        ),
      },
      {
        accessorKey: 'comment',
        header: 'Комментарий',
        enableSorting: false,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <span className="text-[var(--color-muted-fg)]">{v}</span>
          ) : (
            <span className="text-[var(--color-muted-fg)]/60">—</span>
          );
        },
      },
    ],
    [],
  );

  // Тип и «только разрывы» фильтруем на клиенте: эндпоинт таких параметров
  // не принимает, а выборка и так ограничена HISTORY_LIMIT записями.
  const visibleRows = useMemo(
    () =>
      rows
        .filter((r) => (kind === 'all' ? true : r.contractKind === kind))
        .filter((r) => (breakupsOnly ? BREAKUP_STATUSES.has(r.toStatusCode) : true)),
    [rows, kind, breakupsOnly],
  );

  const hasFilter = Boolean(companyId || personId || branchCode) || kind !== 'all' || breakupsOnly;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={branchCode}
          onChange={(v) => {
            setBranchCode(v as BranchCode | '');
            // Выбранная компания могла быть из другой отрасли — иначе фильтры
            // противоречат друг другу и выдача пустеет без видимой причины.
            setCompanyId('');
          }}
          placeholder="Отрасль: все"
          options={BRANCHES.map((code) => ({ id: code, name: BRANCH_LABELS[code] }))}
        />
        <FilterSelect
          value={companyId}
          onChange={setCompanyId}
          placeholder="Компания: все"
          options={companyOptions}
        />
        <FilterSelect
          value={personId}
          onChange={setPersonId}
          placeholder="Персонаж: все"
          options={personOptions}
        />
        <FilterSelect
          value={kind === 'all' ? '' : kind}
          onChange={(v) => setKind((v || 'all') as KindFilter)}
          placeholder="Тип: постоянные и временные"
          options={[
            { id: 'permanent', name: 'Только постоянные' },
            { id: 'temporary', name: 'Только временные' },
          ]}
        />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-muted-fg)] transition-colors hover:text-[var(--color-fg)]">
          <input
            type="checkbox"
            checked={breakupsOnly}
            onChange={(e) => setBreakupsOnly(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Только разрывы
        </label>
        {hasFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCompanyId('');
              setPersonId('');
              setBranchCode('');
              setKind('all');
              setBreakupsOnly(false);
            }}
          >
            Сбросить
          </Button>
        )}
        <span className="ml-auto text-xs text-[var(--color-subtle-fg)]">
          Показано <MonoValue>{visibleRows.length}</MonoValue> из{' '}
          <MonoValue>{allRows.length}</MonoValue>
          {allRows.length >= HISTORY_LIMIT ? ` (лимит ${HISTORY_LIMIT})` : ''}
        </span>
      </div>

      <InfoTable
        title="Перезаключения контрактов"
        data={visibleRows}
        columns={columns}
        emptyText="Переходов статусов пока нет"
      />
    </div>
  );
}

type SelectOption = { id: string; name: string };
type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: SelectOption[];
};

const FilterSelect = ({ value, onChange, placeholder, options }: SelectProps) => (
  <NativeSelect
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label={placeholder}
    className="h-9 min-w-[190px] text-xs"
  >
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o.id} value={o.id}>
        {o.name}
      </option>
    ))}
  </NativeSelect>
);

const dtFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dtFormatter.format(d);
};
