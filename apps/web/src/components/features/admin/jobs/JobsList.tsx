import { listJobs, runJobNow } from '@/api/admin/jobs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { skeletonKeys } from '@/lib/skeletonKeys';
import type { JobDefinitionWithLastRunDto } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { History, Pencil, Play } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDangerDialog } from '../ConfirmDangerDialog';
import { JobEditDialog } from './JobEditDialog';
import { JobStatusBadge } from './JobStatusBadge';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

export const JobsList = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<JobDefinitionWithLastRunDto | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const query = useQuery({ queryKey: ['admin', 'jobs'], queryFn: listJobs });

  const runMutation = useMutation({
    mutationFn: (job: JobDefinitionWithLastRunDto) => runJobNow(job.key),
    onSuccess: () => {
      toast.success('Задача запущена');
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  return (
    <>
      <div className="rounded-md border border-[var(--color-border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Расписание</TableHead>
              <TableHead>Часовой пояс</TableHead>
              <TableHead>Активна</TableHead>
              <TableHead>Последний запуск</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              skeletonKeys(4).map((k) => (
                <TableRow key={k}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : query.data && query.data.length > 0 ? (
              query.data.map((j) => (
                <TableRow key={j.key}>
                  <TableCell>
                    <div className="font-medium">{j.name}</div>
                    <div className="text-xs text-[var(--color-muted-fg)]">{j.key}</div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{j.cronExpr}</code>
                  </TableCell>
                  <TableCell className="text-xs">{j.timezone}</TableCell>
                  <TableCell>
                    {j.enabled ? (
                      <Badge variant="success">Да</Badge>
                    ) : (
                      <Badge variant="secondary">Нет</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {j.lastRun ? (
                      <div className="flex flex-col gap-1">
                        <JobStatusBadge status={j.lastRun.status} />
                        <span className="text-xs text-[var(--color-muted-fg)]">
                          {fmt(j.lastRun.startedAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--color-muted-fg)]">Не запускалась</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/admin/jobs/$key" params={{ key: j.key }}>
                          <History className="mr-1 h-3.5 w-3.5" />
                          История
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(j);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Изменить
                      </Button>
                      <ConfirmDangerDialog
                        trigger={
                          <Button size="sm" variant="default">
                            <Play className="mr-1 h-3.5 w-3.5" />
                            Запустить
                          </Button>
                        }
                        title={`Запустить «${j.name}»?`}
                        description="Будет создан внеочередной запуск задачи."
                        variant="default"
                        confirmLabel="Запустить"
                        isLoading={runMutation.isPending}
                        onConfirm={() => runMutation.mutateAsync(j)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--color-muted-fg)]">
                  Нет задач.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <JobEditDialog job={editing} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
};
