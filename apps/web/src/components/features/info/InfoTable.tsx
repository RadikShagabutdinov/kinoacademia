import { Input } from '@/components/ui/input';
import { MonoValue } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

type Props<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** Заголовок таблицы. */
  title: string;
  /** Поле, по которому работает поиск. Если не задан — поиск скрыт. */
  searchField?: keyof TData & string;
  searchPlaceholder?: string;
  emptyText?: string;
};

/**
 * Плотная аналитическая таблица для мониторов менеджера информации:
 * сортировка по колонкам и опциональный поиск по одному текстовому полю.
 */
export const InfoTable = <TData,>({
  data,
  columns,
  title,
  searchField,
  searchPlaceholder = 'Поиск...',
  emptyText = 'Нет данных',
}: Props<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: searchField
      ? (row, _columnId, filterValue: string) => {
          const value = row.original[searchField];
          if (typeof value !== 'string') return true;
          return value.toLowerCase().includes(filterValue.toLowerCase());
        }
      : 'auto',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3.5 py-2.5">
        <h2 className="text-[13px] font-extrabold">
          {title} <MonoValue className="text-[var(--color-subtle-fg)]">· {data.length}</MonoValue>
        </h2>
        {searchField && (
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-48 text-xs"
          />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[var(--color-card)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--color-border)]">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="bg-[var(--color-card)] px-2.5 py-2 text-left text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--color-subtle-fg)]"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-2.5 py-8 text-center text-[var(--color-subtle-fg)]"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-[var(--color-hairline)] transition-colors hover:bg-[var(--color-muted)]',
                    // Зебра: в макете чётные строки чуть темнее фона карточки.
                    idx % 2 === 1 && 'bg-[var(--color-row-alt)]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2.5 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
