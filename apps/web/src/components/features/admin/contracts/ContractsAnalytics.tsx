import { getContractsHistory } from '@/api/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { CONTRACT_STATUS_LABELS, type ContractStatusCode } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';

const fmt = (iso: string) => new Date(iso).toLocaleString();

export const ContractsAnalytics = () => {
  const query = useQuery({
    queryKey: ['admin', 'contracts-history', 'all'],
    queryFn: () => getContractsHistory({ limit: 200 }),
  });

  const counts: Record<string, number> = {};
  for (const h of query.data ?? []) {
    counts[h.toStatusCode] = (counts[h.toStatusCode] ?? 0) + 1;
  }
  const orderedStatuses = Object.keys(CONTRACT_STATUS_LABELS) as ContractStatusCode[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Сводка по статусам</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {orderedStatuses.map((s) => (
                <div key={s} className="rounded-md border border-[var(--color-border)] p-3">
                  <div className="text-xs text-[var(--color-muted-fg)]">
                    {CONTRACT_STATUS_LABELS[s]}
                  </div>
                  <div className="text-lg font-semibold">{counts[s] ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Лента контрактных событий</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-[var(--color-border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Когда</TableHead>
                  <TableHead>Персонаж</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading ? (
                  skeletonKeys(3).map((k) => (
                    <TableRow key={k}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : query.data && query.data.length > 0 ? (
                  query.data.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs text-[var(--color-muted-fg)]">
                        {fmt(h.changedAt)}
                      </TableCell>
                      <TableCell className="font-medium">{h.personDisplayName}</TableCell>
                      <TableCell>{h.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {h.contractKind === 'permanent' ? 'Постоянный' : 'Временный'}
                        </Badge>
                      </TableCell>
                      <TableCell>{CONTRACT_STATUS_LABELS[h.toStatusCode]}</TableCell>
                      <TableCell className="text-xs">{h.comment ?? '—'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[var(--color-muted-fg)]">
                      Нет событий.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
