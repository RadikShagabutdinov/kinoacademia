import { listAllOscars } from '@/api/oscars';
import { InfoTable } from '@/components/features/info/InfoTable';
import { Badge } from '@/components/ui/badge';
import { useWsChannel } from '@/hooks/useWs';
import { NOMINATION_LABELS, type OscarNominationDetailDto } from '@kinoacademia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback } from 'react';

export const Route = createFileRoute('/_auth/info/oscars')({
  component: InfoOscarsPage,
});

const columns: ColumnDef<OscarNominationDetailDto, unknown>[] = [
  {
    id: 'category',
    header: 'Категория',
    accessorFn: (r) => NOMINATION_LABELS[r.nominationCode],
    cell: ({ row }) => (
      <span className="font-medium">{NOMINATION_LABELS[row.original.nominationCode]}</span>
    ),
  },
  {
    accessorKey: 'filmTitle',
    header: 'Фильм',
    cell: ({ row }) => row.original.filmTitle ?? '—',
  },
  {
    accessorKey: 'personName',
    header: 'Персонаж',
    cell: ({ row }) => row.original.personName ?? '—',
  },
  {
    accessorKey: 'companyName',
    header: 'Компания',
    cell: ({ row }) => row.original.companyName ?? '—',
  },
  {
    id: 'status',
    header: 'Статус',
    accessorFn: (r) => (r.isWinner ? 'Победитель' : 'Подана'),
    cell: ({ row }) =>
      row.original.isWinner ? (
        <Badge variant="star">Победитель</Badge>
      ) : (
        <Badge variant="secondary">Подана</Badge>
      ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('ru-RU'),
  },
];

function InfoOscarsPage() {
  const qc = useQueryClient();
  const onOscarEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['oscars'] });
  }, [qc]);
  useWsChannel('oscars', onOscarEvent);

  const { data = [], isPending } = useQuery({
    queryKey: ['oscars', 'all'],
    queryFn: listAllOscars,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isPending ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>
      ) : (
        <InfoTable data={data} columns={columns} title="Номинации" />
      )}
    </div>
  );
}
