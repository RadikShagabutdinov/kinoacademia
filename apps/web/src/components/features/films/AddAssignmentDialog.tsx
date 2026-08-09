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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { NoticeBox } from '@/components/ui/notice-box';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { getApiErrorMessage } from '@/lib/apiError';
import { FILM_ROLES, FILM_ROLE_LABELS, type FilmRole } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type Props = {
  filmId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const AddAssignmentDialog = ({ filmId, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { data: persons = [] } = useOpenPersons();
  const [personId, setPersonId] = useState('');
  const [role, setRole] = useState<FilmRole>('actor_lead_male');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPersonId('');
    setRole('actor_lead_male');
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () => addAssignment(filmId, { filmId, personId, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['films', filmId] });
      qc.invalidateQueries({ queryKey: ['films'] });
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Не удалось добавить участника'));
    },
  });

  const handleSubmit = () => {
    setError(null);
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
          <DialogTitle>Добавить участника</DialogTitle>
          <DialogDescription>
            Назначьте персонажа на роль в съёмочной группе. Один персонаж может занимать несколько
            разных ролей.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="assignment-person">Персонаж</Label>
            <NativeSelect
              id="assignment-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignment-role">Роль</Label>
            <NativeSelect
              id="assignment-role"
              value={role}
              onChange={(e) => setRole(e.target.value as FilmRole)}
            >
              {FILM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {FILM_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
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
