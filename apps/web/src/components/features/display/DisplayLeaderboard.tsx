import { allRatingsQueryOptions } from '@/api/ratings';
import { useIsNarrow } from '@/hooks/useIsNarrow';
import { useWsChannel, useWsOnline } from '@/hooks/useWs';
import { cn } from '@/lib/utils';
import { STAR_RATING_FULL, STAR_RATING_WITH_CONTRACT } from '@kinoacademia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { CompaniesBoard } from './CompaniesBoard';
import { PersonsBoard } from './PersonsBoard';
import { SwipeBoards } from './SwipeBoards';
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

  const narrow = useIsNarrow();

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
      narrow={narrow}
    />
  );
  const companiesBoard = (
    <CompaniesBoard
      ratings={data.companies}
      meta={data.companyNames}
      limit={limit}
      narrow={narrow}
    />
  );

  return (
    <main
      className={cn(
        'accent-glow relative flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]',
        narrow ? 'px-3 py-4' : 'px-[3vw] py-[4vh]',
      )}
    >
      <header
        className={cn(
          'relative z-[1] flex gap-3',
          narrow ? 'flex-col' : 'items-end justify-between gap-8',
        )}
      >
        <div>
          <div
            className="font-[family-name:var(--font-mono)] font-bold uppercase tracking-[0.3em] text-[var(--color-accent)]"
            style={{ fontSize: DISPLAY_SCALE.brand }}
          >
            Спасибо Киноакадемии!
          </div>
          <h1
            className={cn(
              'font-[family-name:var(--font-display)] font-black leading-none tracking-tight',
              narrow ? 'mt-1' : 'mt-[1.5vh]',
            )}
            style={{ fontSize: narrow ? DISPLAY_SCALE.clock : DISPLAY_SCALE.title }}
          >
            Рейтинги
          </h1>
        </div>
        {/* На телефоне часы и статус связи уходят в одну строку под заголовок:
            вертикали и так впритык. */}
        <div className={cn(narrow ? 'flex items-center justify-between gap-3' : 'text-right')}>
          <div
            className="font-[family-name:var(--font-mono)] font-bold leading-none tabular-nums"
            style={{ fontSize: narrow ? DISPLAY_SCALE.boardTitle : DISPLAY_SCALE.clock }}
          >
            {clock}
          </div>
          <div
            className={cn(
              'flex items-center justify-end gap-2 font-semibold',
              narrow ? 'mt-0' : 'mt-[1.2vh]',
            )}
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

      <div
        className={cn(
          'relative z-[1] flex min-h-0 flex-1',
          narrow ? 'mt-3' : 'mt-[3.5vh] gap-[3vw]',
        )}
      >
        {/* На узком экране раскладку из URL игнорируем: два блока рядом туда не помещаются. */}
        {narrow ? (
          <SwipeBoards persons={personsBoard} companies={companiesBoard} />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Правило статуса Звезды берём из общих констант. Расписание капитализации
          в сноску не выносим: оно живёт в job_definitions и роли info недоступно. */}
      <footer
        className={cn('relative z-[1] text-[var(--color-subtle-fg)]', narrow ? 'mt-3' : 'mt-[2vh]')}
        style={{ fontSize: DISPLAY_SCALE.footnote }}
      >
        <span className="text-[var(--color-star)]">★</span> — Звезда: рейтинг ≥ {STAR_RATING_FULL}{' '}
        либо ≥ {STAR_RATING_WITH_CONTRACT} с постоянным контрактом
      </footer>
    </main>
  );
};
