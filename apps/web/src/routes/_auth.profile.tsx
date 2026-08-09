import { logout } from '@/api/auth';
import { getMyContracts } from '@/api/contracts';
import { listPersonOscars } from '@/api/oscars';
import { getMyRating } from '@/api/ratings';
import { PageHeader } from '@/components/layout/PageHeader';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NoticeBox } from '@/components/ui/notice-box';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { useMe } from '@/hooks/useMe';
import { formatAmount } from '@/lib/tone';
import {
  NOMINATION_LABELS,
  type PersonRatingDto,
  STAR_RATING_FULL,
  STAR_RATING_WITH_CONTRACT,
} from '@kinoacademia/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';

const myRatingQueryOptions = queryOptions<PersonRatingDto>({
  queryKey: ['ratings', 'me'],
  queryFn: getMyRating,
  staleTime: 15_000,
});

export const Route = createFileRoute('/_auth/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const person = me?.person;

  const { data: rating } = useQuery({ ...myRatingQueryOptions, enabled: Boolean(person) });
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', 'my'],
    queryFn: getMyContracts,
    staleTime: 30_000,
    enabled: Boolean(person),
  });
  // Отдельного эндпоинта «фильмы персонажа» нет: номинации приходят с названием
  // фильма и компанией, чего фильмографии достаточно.
  const { data: nominations = [] } = useQuery({
    queryKey: ['oscars', 'person', person?.id],
    queryFn: () => listPersonOscars(person?.id ?? ''),
    staleTime: 60_000,
    enabled: Boolean(person),
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      navigate({ to: '/login' });
    },
  });

  if (!me) return null;
  const wins = nominations.filter((n) => n.isWinner).length;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Профиль" backTo="/" />

      {person ? (
        <>
          <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-[family-name:var(--font-display)] truncate text-[22px] font-black leading-none">
                  {person.displayName}
                </div>
                {person.age !== null && (
                  <SectionLabel className="mt-2">{person.age} лет</SectionLabel>
                )}
                {rating?.isStar && (
                  <Badge variant="star" className="mt-2.5">
                    ★ Звезда
                  </Badge>
                )}
              </div>
            </div>
          </section>

          <NoticeBox tone={rating?.isStar ? 'star' : 'muted'}>
            Статус Звезды держится условием «рейтинг ≥ {STAR_RATING_FULL}» либо «≥{' '}
            {STAR_RATING_WITH_CONTRACT} с действующим постоянным контрактом». Потеря условия —
            потеря статуса и множителя ×5.
          </NoticeBox>

          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Рейтинг" value={formatAmount(rating?.nowPermanent ?? 0)} accent />
            <StatTile label="Оскары" value={String(wins)} />
            <StatTile label="Контракты" value={String(contracts.length)} />
          </div>

          <section>
            <SectionLabel className="mb-2.5">Фильмография</SectionLabel>
            {nominations.length === 0 ? (
              <p className="text-xs text-[var(--color-subtle-fg)]">
                Пока ни одной номинации. Появятся, когда кинокомпания подаст вас на Оскар.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {nominations.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{n.filmTitle ?? '—'}</div>
                      <div className="truncate text-[11px] text-[var(--color-subtle-fg)]">
                        {NOMINATION_LABELS[n.nominationCode]}
                        {n.companyName ? ` · ${n.companyName}` : ''}
                      </div>
                    </div>
                    <Badge variant={n.isWinner ? 'star' : 'outline'}>
                      {n.isWinner ? '★ Победа' : 'Номинация'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Персонаж не назначен</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-muted-fg)]">
            Вы вошли как {me.user.login}. Персонажа создаёт мастер игры.
          </CardContent>
        </Card>
      )}

      <section className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
        <span className="text-sm font-bold">Тема оформления</span>
        <ThemeToggle />
      </section>

      <Button
        variant="destructive"
        size="xl"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="h-4 w-4" />
        {logoutMutation.isPending ? 'Выходим…' : 'Выйти'}
      </Button>
    </div>
  );
}

type StatTileProps = { label: string; value: string; accent?: boolean };

const StatTile = ({ label, value, accent }: StatTileProps) => (
  <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-4 text-center">
    <DisplayNumber size="sm" className={accent ? 'text-[var(--color-accent)]' : undefined}>
      {value}
    </DisplayNumber>
    <SectionLabel className="mt-2">{label}</SectionLabel>
  </div>
);
