import { myCompanyQueryOptions } from '@/api/companies';
import { listCompanyFilms } from '@/api/films';
import { CreateFilmDialog } from '@/components/features/films/CreateFilmDialog';
import { FilmCard } from '@/components/features/films/FilmCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { NoticeBox } from '@/components/ui/notice-box';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/company/films')({
  beforeLoad: ({ context }) => {
    const company = context.queryClient.getQueryData(myCompanyQueryOptions.queryKey);
    if (company && company.branchCode !== 'cinema') {
      throw redirect({ to: '/company/rating' });
    }
  },
  component: CompanyFilmsPage,
});

function CompanyFilmsPage() {
  const { data: company } = useQuery(myCompanyQueryOptions);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: films = [], isPending } = useQuery({
    queryKey: ['films', 'company', company?.id ?? ''],
    queryFn: () => listCompanyFilms(company?.id ?? ''),
    enabled: Boolean(company?.id),
  });

  if (!company) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Фильмы"
        backTo="/"
        overline={company.name}
        actions={
          <Button size="icon" onClick={() => setCreateOpen(true)} aria-label="Заявить фильм">
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      {isPending && <p className="text-sm text-[var(--color-subtle-fg)]">Загрузка…</p>}

      {!isPending && films.length === 0 && (
        <NoticeBox tone="muted">
          Пока нет ни одного фильма. Состав съёмочной группы можно расширять, пока фильм не получил
          награду.
        </NoticeBox>
      )}

      <div className="space-y-3">
        {films.map((f) => (
          <FilmCard key={f.id} film={f} canEdit />
        ))}
      </div>

      <CreateFilmDialog companyId={company.id} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
