import { updateUser } from '@/api/admin/users';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ROLES, ROLE_LABELS, type RoleCode, type UserDto } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Props = {
  user: UserDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const EditUserRoleDialog = ({ user, open, onOpenChange }: Props) => {
  const [role, setRole] = useState<RoleCode>('emp');
  const qc = useQueryClient();

  useEffect(() => {
    if (user) setRole(user.roleCode);
  }, [user]);

  const mutation = useMutation({
    mutationFn: (input: { id: string; roleCode: RoleCode }) =>
      updateUser(input.id, { roleCode: input.roleCode }),
    onSuccess: () => {
      toast.success('Роль обновлена');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить роль</DialogTitle>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Пользователь</Label>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm">
            {user.login}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Роль</Label>
          <Select value={role} onValueChange={(v) => setRole(v as RoleCode)}>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={mutation.isPending || role === user.roleCode}
            onClick={() => mutation.mutate({ id: user.id, roleCode: role })}
          >
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
