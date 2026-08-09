import { createUser } from '@/api/admin/users';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { type CreateUserResponse, ROLES, ROLE_LABELS, type RoleCode } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TempPasswordDialog } from './TempPasswordDialog';

type FormValues = { login: string; roleCode: RoleCode };

export const CreateUserDialog = () => {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<CreateUserResponse | null>(null);
  const qc = useQueryClient();

  const { register, handleSubmit, formState, control, reset } = useForm<FormValues>({
    defaultValues: { login: '', roleCode: 'emp' },
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      toast.success('Пользователь создан');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setCreated(data);
      setOpen(false);
      reset();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Не удалось создать пользователя'));
    },
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Создать
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
            <DialogDescription>Будет сгенерирован одноразовый временный пароль.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <div className="space-y-1.5">
              <Label htmlFor="login">Логин</Label>
              <Input
                id="login"
                autoComplete="off"
                {...register('login', {
                  required: 'Введите логин',
                  minLength: { value: 3, message: 'Минимум 3 символа' },
                  maxLength: { value: 64, message: 'Максимум 64 символа' },
                  pattern: {
                    value: /^[a-zA-Z0-9._-]+$/,
                    message: 'Только латиница, цифры, точка, подчёркивание, дефис',
                  },
                })}
              />
              {formState.errors.login ? (
                <p className="text-xs text-[var(--color-destructive)]">
                  {formState.errors.login.message}
                </p>
              ) : null}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Создание…' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TempPasswordDialog
        open={created !== null}
        onOpenChange={(v) => !v && setCreated(null)}
        temporaryPassword={created?.temporaryPassword ?? null}
        login={created?.user.login ?? null}
      />
    </>
  );
};
