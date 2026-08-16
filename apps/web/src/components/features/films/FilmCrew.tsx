import { getFilm } from '@/api/films';
import { FILM_ROLES, FILM_ROLE_LABELS } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { groupByRole } from './groupByRole';

type Props = {
  filmId: string;
};

/**
 * Съёмочная группа фильма — только назначенные роли.
 * Запрос уходит при монтировании, т.е. когда строку раскрыли; ключ совпадает
 * с `FilmCard`, поэтому кэш общий.
 */
export const FilmCrew = ({ filmId }: Props) => {
  const { data: detail, isPending } = useQuery({
    queryKey: ['films', filmId],
    queryFn: () => getFilm(filmId),
  });

  if (isPending) {
    return <p className="text-xs text-[var(--color-subtle-fg)]">Загрузка…</p>;
  }

  const byRole = groupByRole(detail?.assignments ?? []);
  const filled = FILM_ROLES.filter((role) => (byRole.get(role)?.length ?? 0) > 0);

  if (filled.length === 0) {
    return <p className="text-xs text-[var(--color-subtle-fg)]">Съёмочная группа не назначена</p>;
  }

  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5">
      {filled.map((role) => (
        <div key={role} className="contents">
          <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-subtle-fg)]">
            {FILM_ROLE_LABELS[role]}
          </dt>
          <dd className="text-[12px] font-semibold">
            {(byRole.get(role) ?? []).map((a) => a.personName).join(', ')}
          </dd>
        </div>
      ))}
    </dl>
  );
};
