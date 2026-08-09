import { myCompanyQueryOptions } from '@/api/companies';
import { listCompanyFilms } from '@/api/films';
import { listCompanyOscars } from '@/api/oscars';
import { NominationsTable } from '@/components/features/oscars/NominationsTable';
import { SubmitNominationDialog } from '@/components/features/oscars/SubmitNominationDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { NoticeBox } from '@/components/ui/notice-box';
import { SectionLabel } from '@/components/ui/typography';
import { useWsChannel } from '@/hooks/useWs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Award } from 'lucide-react';
import { useCallback, useState } from 'react';

export const Route = createFileRoute('/_auth/company/oscar-nominations')({
  beforeLoad: ({ context }) => {
    const company = context.queryClient.getQueryData(myCompanyQueryOptions.queryKey);
    if (company && company.branchCode !== 'cinema') {
      throw redirect({ to: '/company/rating' });
    }
  },
  component: CompanyOscarNominationsPage,
});

function CompanyOscarNominationsPage() {
  const qc = useQueryClient();
  const { data: company } = useQuery(myCompanyQueryOptions);
  const [open, setOpen] = useState(false);

  const onOscarEvent = useCallback(() => {
    if (!company?.id) return;
    qc.invalidateQueries({ queryKey: ['oscars', 'company', company.id] });
  }, [qc, company?.id]);
  useWsChannel('oscars', onOscarEvent);

  const { data: films = [] } = useQuery({
    queryKey: ['films', 'company', company?.id ?? ''],
    queryFn: () => listCompanyFilms(company?.id ?? ''),
    enabled: Boolean(company?.id),
  });

  const { data: nominations = [], isPending } = useQuery({
    queryKey: ['oscars', 'company', company?.id ?? ''],
    queryFn: () => listCompanyOscars(company?.id ?? ''),
    enabled: Boolean(company?.id),
  });

  if (!company) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Номинации" backTo="/" overline={company.name} />

      <section className="rounded-[var(--radius-2xl)] border border-[color-mix(in_oklab,var(--color-accent)_30%,transparent)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
        <div className="flex items-center gap-2.5">
          <Award className="h-[18px] w-[18px] text-[var(--color-accent)]" />
          <span className="text-sm font-extrabold">Подать номинацию</span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle-fg)]">
          Категория задаёт роль: список персонажей подбирается из съёмочной группы фильма
          автоматически. Если подходящей роли в фильме нет, сначала назначьте её.
        </p>
        {films.length === 0 ? (
          <NoticeBox tone="danger" className="mt-4">
            У компании ещё нет фильмов — номинировать некого.
          </NoticeBox>
        ) : (
          <Button size="xl" className="mt-4" onClick={() => setOpen(true)}>
            Выбрать категорию
          </Button>
        )}
      </section>

      <div>
        <SectionLabel className="mb-2.5">Поданные номинации · {nominations.length}</SectionLabel>
        {isPending ? (
          <p className="text-sm text-[var(--color-subtle-fg)]">Загрузка…</p>
        ) : (
          <NominationsTable rows={nominations} emptyMessage="Пока ни одна номинация не подана." />
        )}
      </div>

      <SubmitNominationDialog films={films} open={open} onOpenChange={setOpen} />
    </div>
  );
}
