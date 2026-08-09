import { changePassword, logout } from '@/api/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { meQueryOptions } from '@/hooks/useMe';
import { getApiErrorMessage } from '@/lib/apiError';
import { type MeDto, ROLE_LABELS } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { KeyRound, LogOut } from 'lucide-react';
import { useState } from 'react';

type Props = { me: MeDto };

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export const UserMenu = ({ me }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const display = me.person?.displayName ?? me.user.login;
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { mutate: doLogout, isPending } = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate({ to: '/login' });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      toast.success('Пароль изменён');
      await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Не удалось сменить пароль')),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="size-8">
              <AvatarFallback>{initials(display)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline">{display}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{display}</span>
            <span className="text-xs text-[var(--color-muted-fg)]">@{me.user.login}</span>
            <span className="text-xs text-[var(--color-muted-fg)]">
              {ROLE_LABELS[me.user.roleCode]}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
            <span>Сменить пароль</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onSelect={() => doLogout()}>
            <LogOut className="h-4 w-4" />
            <span>Выйти</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Смена пароля</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              changePasswordMutation.mutate({ currentPassword, newPassword });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="menu-current">Текущий пароль</Label>
              <Input
                id="menu-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-new">Новый пароль</Label>
              <Input
                id="menu-new"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
