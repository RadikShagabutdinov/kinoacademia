import { allRatingsQueryOptions } from '@/api/ratings';
import { InfoTable } from '@/components/features/info/InfoTable';
import { MonoValue } from '@/components/ui/typography';
import { useWsChannel } from '@/hooks/useWs';
import { BRANCH_LABELS, type CompanyRatingDto, type PersonRatingDto } from '@kinoacademia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';

export const Route = createFileRoute('/_auth/info/ratings')({
  component: InfoRatingsPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(allRatingsQueryOptions),
});

type PersonRow = PersonRatingDto & { displayName: string };
type CompanyRow = CompanyRatingDto & { name: string; branchLabel: string };

function InfoRatingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(allRatingsQueryOptions);

  const onRatingEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ratings', 'all'] });
  }, [qc]);

  useWsChannel('ratings:all', onRatingEvent);

  const personRows = useMemo<PersonRow[]>(
    () =>
      (data?.persons ?? []).map((p) => ({
        ...p,
        displayName: data?.personNames[p.personId]?.displayName ?? '—',
      })),
    [data],
  );

  const companyRows = useMemo<CompanyRow[]>(
    () =>
      (data?.companies ?? []).map((c) => {
        const meta = data?.companyNames[c.companyId];
        return {
          ...c,
          name: meta?.name ?? '—',
          branchLabel: meta ? BRANCH_LABELS[meta.branchCode] : '—',
        };
      }),
    [data],
  );

  const personColumns = useMemo<ColumnDef<PersonRow>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Персонаж',
        cell: ({ row }) => <span className="font-medium">{row.original.displayName}</span>,
      },
      {
        accessorKey: 'nowPermanent',
        header: 'Постоянный',
        cell: ({ getValue }) => numCell(getValue()),
      },
      {
        accessorKey: 'generated',
        header: 'Переменный',
        cell: ({ getValue }) => numCell(getValue()),
      },
      { accessorKey: 'manualTopup', header: 'Ручные', cell: ({ getValue }) => numCell(getValue()) },
      { accessorKey: 'oscar', header: 'Оскар', cell: ({ getValue }) => numCell(getValue()) },
      { accessorKey: 'penalties', header: 'Штрафы', cell: ({ getValue }) => numCell(getValue()) },
      {
        accessorKey: 'isStar',
        header: 'Звезда',
        cell: ({ getValue }) =>
          getValue() ? <span className="text-[var(--color-star)]">★</span> : '',
      },
    ],
    [],
  );

  const companyColumns = useMemo<ColumnDef<CompanyRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Компания',
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      { accessorKey: 'branchLabel', header: 'Сфера' },
      { accessorKey: 'budget', header: 'Бюджет', cell: ({ getValue }) => numCell(getValue()) },
      {
        accessorKey: 'employeePermanent',
        header: 'Постоянный',
        cell: ({ getValue }) => numCell(getValue()),
      },
      { accessorKey: 'manualTopup', header: 'Ручные', cell: ({ getValue }) => numCell(getValue()) },
      { accessorKey: 'oscar', header: 'Оскар', cell: ({ getValue }) => numCell(getValue()) },
      { accessorKey: 'penalties', header: 'Штрафы', cell: ({ getValue }) => numCell(getValue()) },
    ],
    [],
  );

  if (!data) return null;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
      <InfoTable
        title="Персонажи"
        data={personRows}
        columns={personColumns}
        searchField="displayName"
        searchPlaceholder="Поиск по имени"
        emptyText="Рейтинги персонажей пусты"
      />
      <InfoTable
        title="Компании"
        data={companyRows}
        columns={companyColumns}
        searchField="name"
        searchPlaceholder="Поиск по названию"
        emptyText="Рейтинги компаний пусты"
      />
    </div>
  );
}

// Числа моноширинными: иначе колонки прыгают при live-обновлении по WS.
const numCell = (v: unknown) => (
  <MonoValue className="tabular-nums">
    {typeof v === 'number' ? v.toLocaleString('ru-RU') : '—'}
  </MonoValue>
);
