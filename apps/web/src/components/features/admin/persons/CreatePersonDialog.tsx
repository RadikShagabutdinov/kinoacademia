import { createPerson } from '@/api/admin/persons';
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
  RACES,
  RACE_LABELS,
  ROLES,
  ROLE_LABELS,
  type RaceCode,
  type RoleCode,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
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

export const CreatePersonDialog = () => {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['admin', 'users', 'all'], queryFn: () => listUsers() });

  const { register, handleSubmit, formState, control, reset } = useForm<FormValues>({
    defaultValues: {
      userId: UNASSIGNED,
      displayName: '',
      raceCode: 'homo',
      roleCode: 'emp',
      age: '',
    },
  });

  const mutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      toast.success('Персонаж создан');
      qc.invalidateQueries({ queryKey: ['admin', 'persons'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const onSubmit = (values: FormValues) => {
    const ageNum = values.age ? Number(values.age) : undefined;
    mutation.mutate({
      userId: values.userId === UNASSIGNED ? null : values.userId,
      displayName: values.displayName.trim(),
      raceCode: values.raceCode,
      roleCode: values.roleCode,
      ...(ageNum !== undefined && Number.isFinite(ageNum) ? { age: ageNum } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Создать персонажа
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый персонаж</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Имя</Label>
            <Input
              id="displayName"
              {...register('displayName', {
                required: 'Укажите имя',
                minLength: 1,
                maxLength: 120,
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
            <Label htmlFor="age">Возраст (необязательно)</Label>
            <Input id="age" type="number" min={0} {...register('age')} />
          </div>

          <div className="space-y-1.5">
            <Label>Привязать к пользователю</Label>
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
              {mutation.isPending ? 'Создание…' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
