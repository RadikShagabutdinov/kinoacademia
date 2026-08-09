import { getAdminAllRatings } from '@/api/admin/ratings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { AuditLogList } from '../AuditLogList';

type Props = { personId: string };

export const DossierRatingTab = ({ personId }: Props) => {
  const query = useQuery({ queryKey: ['admin', 'all-ratings'], queryFn: getAdminAllRatings });
  const rating = query.data?.persons.find((r) => r.personId === personId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Постоянный рейтинг</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : rating ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Сейчас" value={rating.nowPermanent} highlight />
              <Stat label="База" value={rating.base} />
              <Stat label="Рандомайзер" value={rating.randomizer} />
              <Stat label="Систем. пополнение" value={rating.systemTopup} />
              <Stat label="Ручное" value={rating.manualTopup} />
              <Stat label="Оскар" value={rating.oscar} />
              <Stat label="Штрафы" value={rating.penalties} />
              <Stat label="Переменный" value={rating.generated} />
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted-fg)]">Нет данных о рейтинге.</p>
          )}
        </CardContent>
      </Card>

      <AuditLogList
        filter={{ entityType: 'person', entityId: personId, limit: 30 }}
        title="История админ-операций по персонажу"
      />
    </div>
  );
};

const Stat = ({
  label,
  value,
  highlight,
}: { label: string; value: number; highlight?: boolean }) => (
  <div className="rounded-md border border-[var(--color-border)] p-3">
    <div className="text-xs text-[var(--color-muted-fg)]">{label}</div>
    <div className={highlight ? 'text-2xl font-bold' : 'text-lg font-medium'}>{value}</div>
  </div>
);
