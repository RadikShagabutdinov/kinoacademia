import { listPersonOscars } from '@/api/oscars';
import { NominationsTable } from '@/components/features/oscars/NominationsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

type Props = { personId: string };

export const DossierOscarsTab = ({ personId }: Props) => {
  const { data = [], isPending } = useQuery({
    queryKey: ['oscars', 'person', personId],
    queryFn: () => listPersonOscars(personId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Оскары</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>
        ) : (
          <NominationsTable rows={data} emptyMessage="Номинаций у персонажа пока нет." />
        )}
      </CardContent>
    </Card>
  );
};
