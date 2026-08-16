import { type FilmListItem, getFilm, removeAssignment } from '@/api/films';
import { listFilmOscars } from '@/api/oscars';
import { ConfirmDangerDialog } from '@/components/features/admin/ConfirmDangerDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { NoticeBox } from '@/components/ui/notice-box';
import { FILM_ROLES, FILM_ROLE_LABELS } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddAssignmentDialog } from './AddAssignmentDialog';
import { getFilmErrorMessage } from './filmErrors';
import { groupByRole } from './groupByRole';

type Props = {
  film: FilmListItem;
  /** Если true — показываем кнопку «Изменить съёмочную группу». */
  canEdit: boolean;
};

export const FilmCard = ({ film, canEdit }: Props) => {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: detail, isPending } = useQuery({
    queryKey: ['films', film.id],
    queryFn: () => getFilm(film.id),
  });
  const { data: nominations = [] } = useQuery({
    queryKey: ['oscars', 'film', film.id],
    queryFn: () => listFilmOscars(film.id),
    staleTime: 60_000,
  });

  const removal = useMutation({
    mutationFn: (assignmentId: string) => removeAssignment(film.id, assignmentId),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['films', film.id] });
      qc.invalidateQueries({ queryKey: ['films'] });
    },
    onError: (err: unknown) => {
      setError(`Не удалось удалить участника: ${getFilmErrorMessage(err, 'неизвестная ошибка')}`);
    },
  });

  // Показываем все роли, а не только занятые: незакрытая роль — это подсказка
  // руководителю, и без неё непонятно, почему номинация недоступна.
  const byRole = groupByRole(detail?.assignments ?? []);

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

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-hairline)] pt-3.5">
        {isPending ? (
          <p className="text-xs text-[var(--color-subtle-fg)]">Загрузка…</p>
        ) : (
          FILM_ROLES.map((role) => {
            const people = byRole.get(role) ?? [];
            return (
              <div key={role} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-subtle-fg)]">
                  {FILM_ROLE_LABELS[role]}
                </span>
                {people.length === 0 ? (
                  <span className="text-[12.5px] font-bold text-[var(--color-subtle-fg)]">
                    не назначен
                  </span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {people.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[12.5px] font-bold">
                          {a.personName}
                        </span>
                        {canEdit && (
                          <ConfirmDangerDialog
                            title="Убрать участника?"
                            description={`${a.personName} — ${FILM_ROLE_LABELS[role]} в фильме «${film.title}». Назначение будет удалено.`}
                            confirmLabel="Убрать"
                            isLoading={removal.isPending}
                            // mutateAsync отклоняется при ошибке — гасим reject,
                            // сообщение уже выставит onError мутации.
                            onConfirm={() => removal.mutateAsync(a.id).catch(() => undefined)}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-[var(--color-subtle-fg)] hover:text-[var(--color-destructive)]"
                                aria-label={`Убрать ${a.personName} из съёмочной группы`}
                                disabled={removal.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && (
        <NoticeBox tone="danger" className="mt-3">
          {error}
        </NoticeBox>
      )}

      {canEdit && (
        <>
          <Button variant="outline" size="xl" className="mt-4" onClick={() => setAddOpen(true)}>
            Изменить съёмочную группу
          </Button>
          <AddAssignmentDialog
            filmId={film.id}
            assignments={detail?.assignments ?? []}
            open={addOpen}
            onOpenChange={setAddOpen}
          />
        </>
      )}
    </Card>
  );
};
