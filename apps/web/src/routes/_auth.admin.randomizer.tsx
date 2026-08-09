import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { AuditLogList } from '@/components/features/admin/AuditLogList';
import { RandomizerForm } from '@/components/features/admin/randomizer/RandomizerForm';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/randomizer')({
  component: AdminRandomizerPage,
});

function AdminRandomizerPage() {
  return (
    <AdminLayout
      title="Рандомайзер"
      description="Случайные значения постоянного рейтинга для всех открытых персонажей."
    >
      <div className="space-y-6">
        <RandomizerForm />
        <AuditLogList filter={{ entityType: 'randomizer', limit: 20 }} title="История запусков" />
      </div>
    </AdminLayout>
  );
}
