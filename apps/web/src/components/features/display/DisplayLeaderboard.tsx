import { allRatingsQueryOptions } from '@/api/ratings';
import { useWsChannel, useWsOnline } from '@/hooks/useWs';
import { STAR_RATING_FULL, STAR_RATING_WITH_CONTRACT } from '@kinoacademia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { CompaniesBoard } from './CompaniesBoard';
import { PersonsBoard } from './PersonsBoard';
import { DISPLAY_SCALE } from './scale';

export type DisplayLayout = 'two-columns' | 'rotate' | 'persons' | 'companies';
export type DisplayLimit = 'top10' | 'all';

type DisplayLeaderboardProps = {
  layout: DisplayLayout;
  limit: DisplayLimit;
  intervalSec: number;
};

const useClock = (): string => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const DisplayLeaderboard = ({ layout, limit, intervalSec }: DisplayLeaderboardProps) => {
  const qc = useQueryClient();
  const { data } = useQuery(allRatingsQueryOptions);
  const online = useWsOnline();
  const clock = useClock();

  const onRatingEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ratings', 'all'] });
  }, [qc]);
  useWsChannel('ratings:all', onRatingEvent);

  const [rotateView, setRotateView] = useState<'persons' | 'companies'>('persons');
  useEffect(() => {
    if (layout !== 'rotate') return;
    const id = setInterval(
      () => setRotateView((v) => (v === 'persons' ? 'companies' : 'persons')),
      Math.max(2, intervalSec) * 1000,
    );
    return () => clearInterval(id);
  }, [layout, intervalSec]);

  if (!data) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted-fg)]">
        Загрузка…
      </div>
    );
  }

  const personsBoard = (
    <PersonsBoard
      ratings={data.persons}
      meta={data.personNames}
      limit={limit}
      intervalSec={intervalSec}
    />
  );
  const companiesBoard = (
    <CompaniesBoard ratings={data.companies} meta={data.companyNames} limit={limit} />
  );

  return (
    <main className="accent-glow relative flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--color-bg)] px-[3vw] py-[4vh] text-[var(--color-fg)]">
      <header className="relative z-[1] flex items-end justify-between gap-8">
        <div>
          <div
            className="font-[family-name:var(--font-mono)] font-bold uppercase tracking-[0.3em] text-[var(--color-accent)]"
            style={{ fontSize: DISPLAY_SCALE.brand }}
          >
            Спасибо Киноакадемии!
          </div>
          <h1
            className="font-[family-name:var(--font-display)] mt-[1.5vh] font-black leading-none tracking-tight"
            style={{ fontSize: DISPLAY_SCALE.title }}
          >
            Рейтинги
          </h1>
        </div>
        <div className="text-right">
          <div
            className="font-[family-name:var(--font-mono)] font-bold leading-none tabular-nums"
            style={{ fontSize: DISPLAY_SCALE.clock }}
          >
            {clock}
          </div>
          <div
            className="mt-[1.2vh] flex items-center justify-end gap-2 font-semibold"
            style={{
              fontSize: DISPLAY_SCALE.columnLabel,
              color: online ? 'var(--color-success)' : 'var(--color-subtle-fg)',
            }}
          >
            <span className="h-[0.6vh] w-[0.6vh] min-h-[7px] min-w-[7px] rounded-full bg-current" />
            {online ? 'обновляется в реальном времени' : 'нет связи с сервером'}
          </div>
        </div>
      </header>

      <div className="relative z-[1] mt-[3.5vh] flex min-h-0 flex-1 gap-[3vw]">
        {layout === 'two-columns' && (
          <>
            <div className="min-w-0 flex-1">{personsBoard}</div>
            <div className="min-w-0 flex-1">{companiesBoard}</div>
          </>
        )}
        {layout === 'persons' && <div className="min-w-0 flex-1">{personsBoard}</div>}
        {layout === 'companies' && <div className="min-w-0 flex-1">{companiesBoard}</div>}
        {layout === 'rotate' && (
          <div className="min-w-0 flex-1">
            {rotateView === 'persons' ? personsBoard : companiesBoard}
          </div>
        )}
      </div>

      {/* Правило статуса Звезды берём из общих констант. Расписание капитализации
          в сноску не выносим: оно живёт в job_definitions и роли info недоступно. */}
      <footer
        className="relative z-[1] mt-[2vh] text-[var(--color-subtle-fg)]"
        style={{ fontSize: DISPLAY_SCALE.footnote }}
      >
        <span className="text-[var(--color-star)]">★</span> — Звезда: рейтинг ≥ {STAR_RATING_FULL}{' '}
        либо ≥ {STAR_RATING_WITH_CONTRACT} с постоянным контрактом
      </footer>
    </main>
  );
};
