import { getContractsHistory } from '@/api/contracts';
import { Badge } from '@/components/ui/badge';
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
import { CONTRACT_STATUS_LABELS } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';

type Props = { personId: string };

const fmt = (iso: string) => new Date(iso).toLocaleString();

export const DossierContractsTab = ({ personId }: Props) => {
  const query = useQuery({
    queryKey: ['admin', 'contracts-history', { personId }],
    queryFn: () => getContractsHistory({ personId, limit: 100 }),
  });

  return (
    <div className="rounded-md border border-[var(--color-border)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Компания</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Когда</TableHead>
            <TableHead>Комментарий</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading ? (
            skeletonKeys(3).map((k) => (
              <TableRow key={k}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : query.data && query.data.length > 0 ? (
            query.data.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.companyName}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {h.contractKind === 'permanent' ? 'Постоянный' : 'Временный'}
                  </Badge>
                </TableCell>
                <TableCell>{CONTRACT_STATUS_LABELS[h.toStatusCode]}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-[var(--color-muted-fg)]">
                  {fmt(h.changedAt)}
                </TableCell>
                <TableCell className="text-xs">{h.comment ?? '—'}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[var(--color-muted-fg)]">
                Нет контрактных изменений.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
