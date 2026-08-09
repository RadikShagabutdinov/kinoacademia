import { listJobRuns } from '@/api/admin/jobs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { JobKey, JobStatus } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { JobStatusBadge } from './JobStatusBadge';

const STATUS_FILTERS: { value: JobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'success', label: 'Успех' },
  { value: 'failed', label: 'Ошибка' },
  { value: 'running', label: 'Выполняется' },
  { value: 'skipped_idempotent', label: 'Пропущено' },
];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
const fmtDuration = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)}с`);

type Props = { jobKey: JobKey };

export const JobRunsHistory = ({ jobKey }: Props) => {
  const [status, setStatus] = useState<JobStatus | 'all'>('all');
  const query = useQuery({
    queryKey: ['admin', 'job-runs', jobKey, { status }],
    queryFn: () =>
      listJobRuns(jobKey, {
        limit: 100,
        ...(status !== 'all' && { status }),
      }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="w-[180px]">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-[var(--color-border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Слот</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Триггер</TableHead>
              <TableHead>Начало</TableHead>
              <TableHead>Окончание</TableHead>
              <TableHead>Длительность</TableHead>
              <TableHead>Ошибка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              skeletonKeys(4).map((k) => (
                <TableRow key={k}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : query.data && query.data.length > 0 ? (
              query.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.slot}</TableCell>
                  <TableCell>
                    <JobStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs">{r.triggeredBy}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmt(r.startedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmt(r.finishedAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDuration(r.durationMs)}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs text-[var(--color-destructive)]">
                    {r.error ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[var(--color-muted-fg)]">
                  Нет запусков.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
