import { updatePerson } from '@/api/admin/persons';
import { listUsers } from '@/api/admin/users';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  type PersonDossierDto,
  RACES,
  RACE_LABELS,
  ROLES,
  ROLE_LABELS,
  type RaceCode,
  type RoleCode,
  type UpdatePersonInput,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

type FormValues = {
  userId: string;
  displayName: string;
  raceCode: RaceCode;
  roleCode: RoleCode;
  age: string;
};

const UNASSIGNED = '__none__';

const toFormValues = (person: PersonDossierDto): FormValues => ({
  userId: person.userId ?? UNASSIGNED,
  displayName: person.displayName,
  raceCode: person.raceCode,
  roleCode: person.roleCode,
  age: person.age === null ? '' : String(person.age),
});

type Props = { person: PersonDossierDto };

export const EditPersonDialog = ({ person }: Props) => {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => listUsers(),
    enabled: open,
  });

  const { register, handleSubmit, formState, control, reset } = useForm<FormValues>({
    defaultValues: toFormValues(person),
  });

  const mutation = useMutation({
    mutationFn: (input: UpdatePersonInput) => updatePerson(person.id, input),
    onSuccess: () => {
      toast.success('Персонаж обновлён');
      qc.invalidateQueries({ queryKey: ['admin', 'persons'] });
      qc.invalidateQueries({ queryKey: ['admin', 'person-dossier', person.id] });
      setOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Не удалось обновить персонажа')),
  });

  // Форма всегда шлёт полный набор полей: PATCH принимает частичный ввод,
  // но отправка неизменённых значений безопасна и упрощает логику.
  const onSubmit = (values: FormValues) => {
    const ageNum = values.age.trim() === '' ? null : Number(values.age);
    mutation.mutate({
      userId: values.userId === UNASSIGNED ? null : values.userId,
      displayName: values.displayName.trim(),
      raceCode: values.raceCode,
      roleCode: values.roleCode,
      age: ageNum !== null && Number.isFinite(ageNum) ? ageNum : null,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(toFormValues(person));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-1 h-4 w-4" />
          Редактировать
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактирование персонажа</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="edit-person-name">Имя</Label>
            <Input
              id="edit-person-name"
              {...register('displayName', {
                required: 'Укажите имя',
                maxLength: { value: 120, message: 'Не больше 120 символов' },
              })}
            />
            {formState.errors.displayName ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {formState.errors.displayName.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Раса</Label>
              <Controller
                control={control}
                name="raceCode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RACES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {RACE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Роль</Label>
              <Controller
                control={control}
                name="roleCode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-person-age">Возраст (необязательно)</Label>
            <Input id="edit-person-age" type="number" min={0} {...register('age')} />
          </div>

          <div className="space-y-1.5">
            <Label>Привязка к пользователю</Label>
            <Controller
              control={control}
              name="userId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Без привязки" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Без привязки</SelectItem>
                    {usersQuery.data?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.login} ({ROLE_LABELS[u.roleCode]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
