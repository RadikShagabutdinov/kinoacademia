import { listAllFilms } from '@/api/films';
import type { FilmListItem } from '@/api/films';
import { InfoTable } from '@/components/features/info/InfoTable';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

export const Route = createFileRoute('/_auth/info/films')({
  component: InfoFilmsPage,
});

const columns: ColumnDef<FilmListItem, unknown>[] = [
  {
    accessorKey: 'title',
    header: 'Название',
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: 'companyName',
    header: 'Компания',
  },
  {
    accessorKey: 'description',
    header: 'Описание',
    enableSorting: false,
    cell: ({ row }) => row.original.description ?? '—',
  },
  {
    accessorKey: 'createdAt',
    header: 'Создан',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('ru-RU'),
  },
];

function InfoFilmsPage() {
  const { data = [], isPending } = useQuery({
    queryKey: ['films', 'all'],
    queryFn: listAllFilms,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {isPending ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>
      ) : (
        <InfoTable
          data={data}
          columns={columns}
          title="Фильмы"
          searchField="title"
          searchPlaceholder="Поиск по названию"
        />
      )}
    </div>
  );
}
