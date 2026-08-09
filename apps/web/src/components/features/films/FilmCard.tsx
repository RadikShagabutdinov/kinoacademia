import { type FilmListItem, getFilm } from '@/api/films';
import { listFilmOscars } from '@/api/oscars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { FILM_ROLES, FILM_ROLE_LABELS } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { Clapperboard } from 'lucide-react';
import { useState } from 'react';
import { AddAssignmentDialog } from './AddAssignmentDialog';

type Props = {
  film: FilmListItem;
  /** Если true — показываем кнопку «Изменить съёмочную группу». */
  canEdit: boolean;
};

export const FilmCard = ({ film, canEdit }: Props) => {
  const [addOpen, setAddOpen] = useState(false);
  const { data: detail, isPending } = useQuery({
    queryKey: ['films', film.id],
    queryFn: () => getFilm(film.id),
  });
  const { data: nominations = [] } = useQuery({
    queryKey: ['oscars', 'film', film.id],
    queryFn: () => listFilmOscars(film.id),
    staleTime: 60_000,
  });

  // Показываем все роли, а не только занятые: незакрытая роль — это подсказка
  // руководителю, и без неё непонятно, почему номинация недоступна.
  const byRole = new Map(detail?.assignments.map((a) => [a.role, a.personName]) ?? []);

  return (
    <Card className="p-4">
      <div className="flex gap-3.5">
        <div className="flex h-[82px] w-[60px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-elevated)]">
          <Clapperboard className="h-6 w-6 text-[var(--color-subtle-fg)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-lg">{film.title}</CardTitle>
          <p className="mt-1.5 truncate text-[11px] text-[var(--color-subtle-fg)]">
            {film.companyName} · {detail?.assignments.length ?? 0} участников
          </p>
          {nominations.length > 0 && (
            <Badge variant="star" className="mt-2">
              ★ {nominations.length} номинаций
            </Badge>
          )}
        </div>
      </div>

      {film.description && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-subtle-fg)]">
          {film.description}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--color-hairline)] pt-3.5">
        {isPending ? (
          <p className="text-xs text-[var(--color-subtle-fg)]">Загрузка…</p>
        ) : (
          FILM_ROLES.map((role) => {
            const person = byRole.get(role);
            return (
              <div key={role} className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-subtle-fg)]">
                  {FILM_ROLE_LABELS[role]}
                </span>
                <span
                  className={
                    person
                      ? 'truncate text-[12.5px] font-bold'
                      : 'truncate text-[12.5px] font-bold text-[var(--color-subtle-fg)]'
                  }
                >
                  {person ?? 'не назначен'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {canEdit && (
        <>
          <Button variant="outline" size="xl" className="mt-4" onClick={() => setAddOpen(true)}>
            Изменить съёмочную группу
          </Button>
          <AddAssignmentDialog filmId={film.id} open={addOpen} onOpenChange={setAddOpen} />
        </>
      )}
    </Card>
  );
};
