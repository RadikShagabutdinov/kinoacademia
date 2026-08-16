import { listAdminPersons } from '@/api/admin/persons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { skeletonKeys } from '@/lib/skeletonKeys';
import { RACE_LABELS, ROLE_LABELS } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Eye } from 'lucide-react';
import { useState } from 'react';

const STATUS_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открытые' },
  { value: 'closed', label: 'Закрытые' },
] as const;

type Status = (typeof STATUS_FILTERS)[number]['value'];

export const PersonsList = () => {
  const [status, setStatus] = useState<Status>('open');

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { status }],
    queryFn: () => listAdminPersons(status === 'all' ? {} : { isOpen: status === 'open' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Combobox
          className="w-[160px]"
          value={status}
          onChange={(v) => setStatus(v as Status)}
          options={[...STATUS_FILTERS]}
          placeholder="Все"
          clearable={false}
          aria-label="Фильтр по статусу"
        />
      </div>

      <div className="rounded-md border border-[var(--color-border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Раса</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personsQuery.isLoading ? (
              skeletonKeys(4).map((k) => (
                <TableRow key={k}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : personsQuery.data && personsQuery.data.length > 0 ? (
              personsQuery.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.displayName}</TableCell>
                  <TableCell>{RACE_LABELS[p.raceCode]}</TableCell>
                  <TableCell>{ROLE_LABELS[p.roleCode]}</TableCell>
                  <TableCell>
                    {p.isOpen ? (
                      <Badge variant="success">Открыт</Badge>
                    ) : (
                      <Badge variant="secondary">Закрыт</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/admin/persons/$id" params={{ id: p.id }}>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Досье
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-[var(--color-muted-fg)]">
                  Нет персонажей.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
