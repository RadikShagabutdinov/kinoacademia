import { getJob } from '@/api/admin/jobs';
import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { AuditLogList } from '@/components/features/admin/AuditLogList';
import { JobRunsHistory } from '@/components/features/admin/jobs/JobRunsHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { JOB_KEYS, type JobKey } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, notFound } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_auth/admin/jobs/$key')({
  parseParams: ({ key }) => {
    if (!(JOB_KEYS as readonly string[]).includes(key)) {
      throw notFound();
    }
    return { key: key as JobKey };
  },
  component: JobDetailsPage,
});

function JobDetailsPage() {
  const { key } = Route.useParams();
  const query = useQuery({ queryKey: ['admin', 'job', key], queryFn: () => getJob(key) });

  return (
    <AdminLayout
      title="Задача"
      actions={
        <Button variant="outline" asChild>
          <Link to="/admin/jobs">
            <ArrowLeft className="mr-1 h-4 w-4" />К списку
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{query.data?.name ?? key}</CardTitle>
          </CardHeader>
          <CardContent>
            {query.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : query.data ? (
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Row label="Ключ" value={<code>{query.data.key}</code>} />
                <Row label="Расписание" value={<code>{query.data.cronExpr}</code>} />
                <Row label="Часовой пояс" value={query.data.timezone} />
                <Row
                  label="Активна"
                  value={
                    query.data.enabled ? (
                      <Badge variant="success">Да</Badge>
                    ) : (
                      <Badge variant="secondary">Нет</Badge>
                    )
                  }
                />
                {query.data.description ? (
                  <div className="col-span-full">
                    <dt className="text-xs text-[var(--color-muted-fg)]">Описание</dt>
                    <dd>{query.data.description}</dd>
                  </div>
                ) : null}
                <div className="col-span-full">
                  <dt className="text-xs text-[var(--color-muted-fg)]">Параметры</dt>
                  <dd>
                    <pre className="overflow-x-auto rounded bg-[var(--color-muted)] p-2 text-xs">
                      {JSON.stringify(query.data.params, null, 2)}
                    </pre>
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История запусков</CardTitle>
          </CardHeader>
          <CardContent>
            <JobRunsHistory jobKey={key} />
          </CardContent>
        </Card>

        {query.data ? (
          <AuditLogList
            filter={{ entityType: 'job', entityId: query.data.id, limit: 30 }}
            title="Изменения и ручные запуски"
          />
        ) : null}
      </div>
    </AdminLayout>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs text-[var(--color-muted-fg)]">{label}</dt>
    <dd>{value}</dd>
  </div>
);
