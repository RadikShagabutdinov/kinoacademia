import { addAssignment } from '@/api/films';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { NoticeBox } from '@/components/ui/notice-box';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import {
  FILM_ROLES,
  FILM_ROLE_LABELS,
  type FilmAssignmentDetailDto,
  type FilmRole,
} from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getFilmErrorMessage } from './filmErrors';

type Props = {
  filmId: string;
  /** Текущий состав — чтобы не предлагать уже назначенных на выбранную роль. */
  assignments: FilmAssignmentDetailDto[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const AddAssignmentDialog = ({ filmId, assignments, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { data: persons = [] } = useOpenPersons();
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [role, setRole] = useState<FilmRole>('actor_lead_male');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const assignedToRole = useMemo(
    () => new Set(assignments.filter((a) => a.role === role).map((a) => a.personId)),
    [assignments, role],
  );

  const visiblePersons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return persons.filter(
      (p) => !assignedToRole.has(p.id) && (!q || p.displayName.toLowerCase().includes(q)),
    );
  }, [persons, assignedToRole, search]);

  const reset = () => {
    setPersonIds([]);
    setRole('actor_lead_male');
    setSearch('');
    setError(null);
  };

  const toggle = (id: string) => {
    setPersonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        personIds.map((personId) => addAssignment(filmId, { filmId, personId, role })),
      );
      const failures = results.flatMap((r, i) =>
        r.status === 'rejected'
          ? [
              {
                name: persons.find((p) => p.id === personIds[i])?.displayName ?? 'Персонаж',
                message: getFilmErrorMessage(r.reason, 'не удалось добавить'),
              },
            ]
          : [],
      );
      return { total: personIds.length, failures };
    },
    onSuccess: ({ total, failures }) => {
      qc.invalidateQueries({ queryKey: ['films', filmId] });
      qc.invalidateQueries({ queryKey: ['films'] });
      // Часть назначений могла не пройти (например, персонаж уже на этой роли) —
      // диалог остаётся открытым со сводкой, успешные уже сохранены.
      if (failures.length > 0) {
        setPersonIds([]);
        setError(
          `Добавлено ${total - failures.length} из ${total}. ${failures
            .map((f) => `${f.name}: ${f.message}`)
            .join('; ')}`,
        );
        return;
      }
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(getFilmErrorMessage(err, 'Не удалось добавить участников'));
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (personIds.length === 0) {
      setError('Выберите хотя бы одного персонажа');
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
          <DialogTitle>Добавить участников</DialogTitle>
          <DialogDescription>
            На каждую позицию можно назначить сколько угодно персонажей. Один персонаж может
            занимать несколько разных ролей.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="assignment-role">Роль</Label>
            <NativeSelect
              id="assignment-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as FilmRole);
                setPersonIds([]);
              }}
            >
              {FILM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {FILM_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignment-search">Персонажи</Label>
            <Input
              id="assignment-search"
              placeholder="Поиск по имени"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
              {visiblePersons.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--color-subtle-fg)]">
                  Нет доступных персонажей
                </p>
              ) : (
                visiblePersons.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--color-hairline)] px-3 py-2 last:border-b-0 hover:bg-[var(--color-muted)]"
                  >
                    <input
                      type="checkbox"
                      checked={personIds.includes(p.id)}
                      onChange={() => toggle(p.id)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0 truncate text-sm">{p.displayName}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-[var(--color-subtle-fg)]">Выбрано: {personIds.length}</p>
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
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Добавляем…' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
