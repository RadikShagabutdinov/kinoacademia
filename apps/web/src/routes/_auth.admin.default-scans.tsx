import { listDefaultScanSets } from '@/api/scans';
import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { ScanSetList } from '@/components/features/scans/ScanSetList';
import { ScanUploadDialog } from '@/components/features/scans/ScanUploadDialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/admin/default-scans')({
  component: AdminDefaultScansPage,
});

function AdminDefaultScansPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ['scans', 'default'],
    queryFn: listDefaultScanSets,
    staleTime: 30_000,
  });

  const companyId = data?.companyId ?? null;
  const sets = data?.sets ?? [];

  return (
    <AdminLayout
      title="Типовые контракты"
      description="Сканы, привязанные к системной компании «Киноакадемия» — доступны всем игрокам как «контракты по умолчанию»."
      actions={
        <Button size="sm" onClick={() => setUploadOpen(true)} disabled={!companyId}>
          <Plus className="h-4 w-4" /> Загрузить сканы
        </Button>
      }
    >
      {!companyId && !isPending ? (
        <p className="text-sm text-[var(--color-muted-fg)]">
          Системная компания не найдена. Убедитесь, что выполнен `pnpm -F api db:seed`.
        </p>
      ) : (
        <ScanSetList sets={sets} canDelete emptyText="Типовых сканов пока нет." />
      )}

      {companyId && (
        <ScanUploadDialog
          companyId={companyId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          invalidateKeys={[['scans', 'default']]}
        />
      )}
    </AdminLayout>
  );
}
