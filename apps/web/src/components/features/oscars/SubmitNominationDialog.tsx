import { type FilmListItem, getFilm } from '@/api/films';
import { submitNomination } from '@/api/oscars';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { NoticeBox } from '@/components/ui/notice-box';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  NOMINATION_LABELS,
  NOMINATION_TO_FILM_ROLE,
  type NominationCode,
  computeNominationCost,
  isCinemaOnlyNomination,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const CINEMA_NOMINATIONS = (Object.keys(NOMINATION_TO_FILM_ROLE) as NominationCode[]).filter(
  isCinemaOnlyNomination,
);

type Props = {
  films: FilmListItem[];
  /** Сколько номинаций компания уже подала — от этого зависит стоимость следующей. */
  nominationsCount: number;
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const SubmitNominationDialog = ({
  films,
  nominationsCount,
  companyId,
  open,
  onOpenChange,
}: Props) => {
  const qc = useQueryClient();
  const [filmId, setFilmId] = useState('');
  const [nominationCode, setNominationCode] = useState<NominationCode>('best_film');
  const [personId, setPersonId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: film } = useQuery({
    queryKey: ['films', filmId],
    queryFn: () => getFilm(filmId),
    enabled: Boolean(filmId),
  });

  const cost = computeNominationCost(nominationsCount);
  const nextCost = computeNominationCost(nominationsCount + 1);

  const requiredRole = NOMINATION_TO_FILM_ROLE[nominationCode];
  const eligibleAssignments =
    requiredRole && film ? film.assignments.filter((a) => a.role === requiredRole) : [];

  const reset = () => {
    setFilmId('');
    setNominationCode('best_film');
    setPersonId('');
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () => submitNomination({ filmId, personId, nominationCode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oscars'] });
      qc.invalidateQueries({ queryKey: ['ratings', 'company', companyId] });
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Не удалось подать номинацию'));
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!filmId) {
      setError('Выберите фильм');
      return;
    }
    if (!personId) {
      setError('Выберите персонажа');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Подать номинацию</DialogTitle>
          <DialogDescription>
            Номинируется участник съёмочной группы. Список персонажей фильтруется по роли,
            подходящей для выбранной номинации.
          </DialogDescription>
        </DialogHeader>

        <NoticeBox tone={cost > 0 ? 'star' : 'muted'}>
          {cost > 0
            ? `Стоимость подачи — ${cost} рейтинга из бюджета компании. Следующая номинация будет стоить ${nextCost}.`
            : `Первая номинация бесплатна. Следующая будет стоить ${nextCost} рейтинга из бюджета компании.`}
        </NoticeBox>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="nomination-film">Фильм</Label>
            <NativeSelect
              id="nomination-film"
              value={filmId}
              onChange={(e) => {
                setFilmId(e.target.value);
                setPersonId('');
              }}
            >
              <option value="">— Выберите —</option>
              {films.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nomination-code">Категория</Label>
            <NativeSelect
              id="nomination-code"
              value={nominationCode}
              onChange={(e) => {
                setNominationCode(e.target.value as NominationCode);
                setPersonId('');
              }}
            >
              {CINEMA_NOMINATIONS.map((code) => (
                <option key={code} value={code}>
                  {NOMINATION_LABELS[code]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nomination-person">Персонаж</Label>
            <NativeSelect
              id="nomination-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              disabled={!filmId}
            >
              <option value="">— Выберите —</option>
              {eligibleAssignments.map((a) => (
                <option key={a.id} value={a.personId}>
                  {a.personName}
                </option>
              ))}
            </NativeSelect>
            {filmId && eligibleAssignments.length === 0 && (
              <p className="text-xs text-[var(--color-muted-fg)]">
                В составе фильма нет участников с подходящей ролью для этой номинации.
              </p>
            )}
          </div>

          {error && <NoticeBox tone="danger">{error}</NoticeBox>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || eligibleAssignments.length === 0}
          >
            {mutation.isPending ? 'Подаём…' : 'Подать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
