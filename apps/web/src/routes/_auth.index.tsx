import { myCompanyQueryOptions } from '@/api/companies';
import { getMyContracts } from '@/api/contracts';
import { getMyRating, getMyRatingHistory } from '@/api/ratings';
import { ActionTile } from '@/components/features/home/ActionTile';
import { CompanyHome } from '@/components/features/home/CompanyHome';
import { PersonHeroCard } from '@/components/features/home/PersonHeroCard';
import { RecentEvents } from '@/components/features/home/RecentEvents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/useMe';
import { useWsChannel } from '@/hooks/useWs';
import type { ContractDto, PersonRatingDto, RatingTransactionDto } from '@kinoacademia/shared';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ClipboardList, Scale, Sparkles } from 'lucide-react';
import { useCallback } from 'react';

const myRatingQueryOptions = queryOptions<PersonRatingDto>({
  queryKey: ['ratings', 'me'],
  queryFn: getMyRating,
  staleTime: 15_000,
});

/** Контракты, по которым персонаж должен принять решение. */
const AWAITING_ME: ReadonlySet<ContractDto['statusCode']> = new Set(['sent', 'breakup_sent']);

export const Route = createFileRoute('/_auth/')({
  component: HomePage,
});

function HomePage() {
  const { data: me } = useMe();
  const isHead = me?.user.roleCode === 'head';

  const { data: company } = useQuery({ ...myCompanyQueryOptions, enabled: isHead });

  if (!me) return null;

  // У руководителя главная показывает и его персонажа, и состояние компании:
  // персонаж со своим рейтингом и контрактами есть у всех участников игры.
  if (isHead) {
    return (
      <div className="space-y-4">
        <HeadPersonSummary person={me.person} />
        {company ? (
          <CompanyHome company={company} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Компания не назначена</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--color-muted-fg)]">
              Дождитесь, пока администратор привяжет вас к компании.
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return <PersonHome meId={me.person?.id} person={me.person} login={me.user.login} />;
}

function HeadPersonSummary({
  person,
}: { person: NonNullable<ReturnType<typeof useMe>['data']>['person'] }) {
  const { data: rating } = useQuery({ ...myRatingQueryOptions, enabled: Boolean(person) });
  if (!person || !rating) return null;
  return <PersonHeroCard person={person} rating={rating} />;
}

type PersonHomeProps = {
  meId: string | undefined;
  person: NonNullable<ReturnType<typeof useMe>['data']>['person'];
  login: string;
};

function PersonHome({ meId, person, login }: PersonHomeProps) {
  const qc = useQueryClient();
  const { data: rating } = useQuery({ ...myRatingQueryOptions, enabled: Boolean(person) });
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'my'],
    queryFn: getMyContracts,
    staleTime: 15_000,
    enabled: Boolean(person),
  });
  const { data: history = [] } = useQuery<RatingTransactionDto[]>({
    queryKey: ['ratings', 'me', 'history', { limit: 5 }],
    queryFn: () => getMyRatingHistory({ limit: 5 }),
    staleTime: 15_000,
    enabled: Boolean(person),
  });

  const onRatingEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ratings', 'me'] });
  }, [qc]);
  useWsChannel(meId ? `person:${meId}` : null, onRatingEvent);

  if (!person) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Персонаж не назначен</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Вы вошли как {login}. Дождитесь, пока мастер игры создаст вашего персонажа.
        </CardContent>
      </Card>
    );
  }

  const awaiting = contracts.filter((c) => AWAITING_ME.has(c.statusCode)).length;

  return (
    <div className="space-y-4">
      {rating && <PersonHeroCard person={person} rating={rating} />}

      <div className="grid grid-cols-2 gap-3">
        <ActionTile
          to="/admire"
          icon={Sparkles}
          title="Выразить восхищение"
          accentIcon
          {...(rating?.isStar ? { hint: '×5 как Звезде' } : {})}
        />
        <ActionTile
          to="/my-contracts"
          icon={ClipboardList}
          title="Мои контракты"
          {...(awaiting > 0
            ? {
                hint: `${awaiting} ${awaiting === 1 ? 'предложение' : 'предложения'}`,
                tone: 'alert' as const,
              }
            : {})}
        />
      </div>

      <Link
        to="/compare"
        className="block rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-accent)]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-bold">
            <Scale className="h-4 w-4 text-[var(--color-accent)]" />
            Встречная проверка
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-accent)]">Сравнить →</span>
        </div>
        <p className="mt-1.5 max-w-[280px] text-[11px] leading-relaxed text-[var(--color-subtle-fg)]">
          Сверьте свой рейтинг с рейтингом любого персонажа — один на один.
        </p>
      </Link>

      {meId && <RecentEvents transactions={history} meId={meId} />}
    </div>
  );
}
