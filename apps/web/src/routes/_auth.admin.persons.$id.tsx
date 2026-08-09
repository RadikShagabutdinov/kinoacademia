import { getPersonDossier } from '@/api/admin/persons';
import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { DossierHeader } from '@/components/features/admin/persons/DossierHeader';
import { DossierTabs } from '@/components/features/admin/persons/DossierTabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/_auth/admin/persons/$id')({
  component: PersonDossierPage,
});

function PersonDossierPage() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ['admin', 'person-dossier', id],
    queryFn: () => getPersonDossier(id),
  });

  return (
    <AdminLayout
      title="Досье персонажа"
      actions={
        <Button variant="outline" asChild>
          <Link to="/admin/persons">
            <ArrowLeft className="mr-1 h-4 w-4" />К списку
          </Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : query.data ? (
        <div className="space-y-4">
          <DossierHeader dossier={query.data} />
          <DossierTabs personId={query.data.id} />
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-fg)]">Персонаж не найден.</p>
      )}
    </AdminLayout>
  );
}
