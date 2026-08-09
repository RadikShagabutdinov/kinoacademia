import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { JobsList } from '@/components/features/admin/jobs/JobsList';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/jobs/')({
  component: AdminJobsPage,
});

function AdminJobsPage() {
  return (
    <AdminLayout
      title="Плановые задачи"
      description="Cron-задачи, ручной запуск и история выполнения. Изменения применяются без перезапуска."
    >
      <JobsList />
    </AdminLayout>
  );
}
