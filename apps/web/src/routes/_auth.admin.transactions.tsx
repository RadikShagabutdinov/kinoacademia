import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { AuditLogList } from '@/components/features/admin/AuditLogList';
import { ManualTxForm } from '@/components/features/admin/transactions/ManualTxForm';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/transactions')({
  component: AdminTransactionsPage,
});

function AdminTransactionsPage() {
  return (
    <AdminLayout
      title="Транзакции рейтинга"
      description="Ручные начисления и списания рейтинга персонажам и компаниям."
    >
      <div className="space-y-6">
        <ManualTxForm />
        <AuditLogList filter={{ limit: 30 }} title="Последние операции" />
      </div>
    </AdminLayout>
  );
}
