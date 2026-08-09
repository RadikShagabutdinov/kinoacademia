import { getMyRating, getMyRatingHistory } from '@/api/ratings';
import { PermanentRatingCard } from '@/components/features/rating/PermanentRatingCard';
import { RatingHistoryList } from '@/components/features/rating/RatingHistoryList';
import { VariableRatingCard } from '@/components/features/rating/VariableRatingCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/useMe';
import { useWsChannel } from '@/hooks/useWs';
import type { PersonRatingDto, RatingTransactionDto } from '@kinoacademia/shared';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';

const myRatingQueryOptions = queryOptions<PersonRatingDto>({
  queryKey: ['ratings', 'me'],
  queryFn: getMyRating,
  staleTime: 15_000,
});

const myHistoryQueryOptions = queryOptions<RatingTransactionDto[]>({
  queryKey: ['ratings', 'me', 'history'],
  queryFn: () => getMyRatingHistory({ limit: 200 }),
  staleTime: 15_000,
});

export const Route = createFileRoute('/_auth/my-rating')({
  component: MyRatingPage,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(myRatingQueryOptions),
      context.queryClient.ensureQueryData(myHistoryQueryOptions),
    ]);
  },
});

function MyRatingPage() {
  const { data: me } = useMe();
  const { data: rating } = useQuery(myRatingQueryOptions);
  const { data: history = [] } = useQuery(myHistoryQueryOptions);
  const qc = useQueryClient();

  const personId = me?.person?.id;

  const onRatingEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ratings', 'me'] });
    qc.invalidateQueries({ queryKey: ['ratings', 'me', 'history'] });
  }, [qc]);

  useWsChannel(personId ? `person:${personId}` : null, onRatingEvent);

  if (!me?.person) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет активного персонажа</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Дождитесь, пока администратор назначит вам персонажа.
        </CardContent>
      </Card>
    );
  }

  if (!rating) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Мой рейтинг" backTo="/" description={me.person.displayName} />

      <VariableRatingCard rating={rating} />
      <PermanentRatingCard rating={rating} />
      <RatingHistoryList transactions={history} meId={me.person.id} />
    </div>
  );
}
