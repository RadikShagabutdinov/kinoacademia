import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { ContractsAnalytics } from '@/components/features/admin/contracts/ContractsAnalytics';
import { ForceBreakPanel } from '@/components/features/admin/contracts/ForceBreakPanel';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/contracts')({
  component: AdminContractsPage,
});

function AdminContractsPage() {
  return (
    <AdminLayout
      title="Аналитика по контрактам"
      description="Сводные данные и история контрактных событий."
    >
      <div className="space-y-4">
        <ContractsAnalytics />
        <ForceBreakPanel />
      </div>
    </AdminLayout>
  );
}
