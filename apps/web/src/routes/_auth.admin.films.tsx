import { listAdminCompanies } from '@/api/admin/companies';
import { listAllFilms } from '@/api/films';
import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { CreateFilmDialog } from '@/components/features/films/CreateFilmDialog';
import { FilmCard } from '@/components/features/films/FilmCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Film } from 'lucide-react';
import { useMemo, useState } from 'react';

export const Route = createFileRoute('/_auth/admin/films')({
  component: AdminFilmsPage,
});

function AdminFilmsPage() {
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [createOpenFor, setCreateOpenFor] = useState<string | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['admin', 'companies', 'cinema'],
    queryFn: () => listAdminCompanies('cinema'),
  });

  const { data: films = [], isPending } = useQuery({
    queryKey: ['films', 'all'],
    queryFn: listAllFilms,
  });

  const filtered = useMemo(
    () => (companyFilter ? films.filter((f) => f.companyId === companyFilter) : films),
    [films, companyFilter],
  );

  return (
    <AdminLayout
      title="Фильмы"
      description="Управление снимаемыми фильмами и их составом."
      actions={
        <Button
          onClick={() => setCreateOpenFor(companyFilter || (companies[0]?.id ?? ''))}
          disabled={companies.length === 0}
        >
          Создать фильм
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-[var(--color-accent)]" />
            Все фильмы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="film-company-filter">Компания</Label>
            <NativeSelect
              id="film-company-filter"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">Все кинокомпании</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {isPending && <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>}
          {!isPending && filtered.length === 0 && (
            <p className="text-sm text-[var(--color-muted-fg)]">Фильмов нет.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.map((f) => (
          <FilmCard key={f.id} film={f} canEdit />
        ))}
      </div>

      {createOpenFor && (
        <CreateFilmDialog
          companyId={createOpenFor}
          open={Boolean(createOpenFor)}
          onOpenChange={(v) => {
            if (!v) setCreateOpenFor(null);
          }}
        />
      )}
    </AdminLayout>
  );
}
