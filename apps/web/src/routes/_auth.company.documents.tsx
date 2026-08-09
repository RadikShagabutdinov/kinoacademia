import { myCompanyQueryOptions } from '@/api/companies';
import { listCompanyScanSets } from '@/api/scans';
import { ScanSetList } from '@/components/features/scans/ScanSetList';
import { ScanUploadDialog } from '@/components/features/scans/ScanUploadDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionLabel } from '@/components/ui/typography';
import { SCAN_MAX_FILE_SIZE, SCAN_MAX_PAGES, type ScanSetDto } from '@kinoacademia/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Upload } from 'lucide-react';
import { useState } from 'react';

const MAX_SIZE_MB = Math.floor(SCAN_MAX_FILE_SIZE / (1024 * 1024));

const companyScansQueryOptions = (companyId: string) =>
  queryOptions<ScanSetDto[]>({
    queryKey: ['scans', 'company', companyId],
    queryFn: () => listCompanyScanSets(companyId),
    staleTime: 30_000,
  });

export const Route = createFileRoute('/_auth/company/documents')({
  component: CompanyDocumentsPage,
  loader: async ({ context }) => {
    const company = context.queryClient.getQueryData(myCompanyQueryOptions.queryKey);
    if (!company) return;
    await context.queryClient.ensureQueryData(companyScansQueryOptions(company.id));
  },
});

function CompanyDocumentsPage() {
  const { data: company } = useQuery(myCompanyQueryOptions);
  const [uploadOpen, setUploadOpen] = useState(false);

  const companyId = company?.id;
  const { data: sets = [] } = useQuery({
    ...companyScansQueryOptions(companyId ?? ''),
    enabled: Boolean(companyId),
  });

  if (!companyId) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Документооборот" backTo="/" overline={company?.name ?? ''} />

      {/* Пунктирная золотая карточка-загрузчик из макета: ограничения берём из
          общих констант, чтобы подпись не разъезжалась с проверками сервера. */}
      <button
        type="button"
        onClick={() => setUploadOpen(true)}
        className="flex w-full items-center gap-3.5 rounded-[var(--radius-xl)] border border-dashed border-[color-mix(in_oklab,var(--color-accent)_45%,transparent)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-4 text-left transition-colors hover:border-[var(--color-accent)]"
      >
        <Upload className="h-6 w-6 shrink-0 text-[var(--color-accent)]" />
        <span>
          <span className="block text-[13.5px] font-extrabold">Загрузить сет сканов</span>
          <span className="mt-1 block text-[11px] text-[var(--color-subtle-fg)]">
            до {SCAN_MAX_PAGES} страниц · JPEG или PDF · до {MAX_SIZE_MB} МБ
          </span>
        </span>
      </button>

      <div>
        <SectionLabel className="mb-2.5">Сеты компании · {sets.length}</SectionLabel>
        <ScanSetList sets={sets} canDelete emptyText="Пока не загружено ни одного скана." />
      </div>

      <ScanUploadDialog companyId={companyId} open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
