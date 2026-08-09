import { createFilm } from '@/api/films';
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
import { NoticeBox } from '@/components/ui/notice-box';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type Props = {
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const CreateFilmDialog = ({ companyId, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      createFilm({
        companyId,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['films'] });
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Не удалось создать фильм'));
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (title.trim().length === 0) {
      setError('Введите название');
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
          <DialogTitle>Новый фильм</DialogTitle>
          <DialogDescription>
            Заявка фильма от лица кинокомпании. Состав участников можно добавить после создания.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="film-title">Название</Label>
            <Input
              id="film-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Например, «Тени над рекой»"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="film-description">Описание</Label>
            <Textarea
              id="film-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
            />
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
            {mutation.isPending ? 'Создаём…' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
