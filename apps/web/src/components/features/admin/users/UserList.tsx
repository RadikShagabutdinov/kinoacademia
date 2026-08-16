import { listUsers, resetUserPassword, updateUser } from '@/api/admin/users';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/apiError';
import { skeletonKeys } from '@/lib/skeletonKeys';
import {
  ROLE_LABELS,
  type ResetPasswordResponse,
  type RoleCode,
  type UserDto,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Power } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDangerDialog } from '../ConfirmDangerDialog';
import { EditUserRoleDialog } from './EditUserRoleDialog';
import { TempPasswordDialog } from './TempPasswordDialog';

const ROLE_FILTERS: { value: RoleCode | 'all'; label: string }[] = [
  { value: 'all', label: 'Все роли' },
  { value: 'emp', label: ROLE_LABELS.emp },
  { value: 'head', label: ROLE_LABELS.head },
  { value: 'info', label: ROLE_LABELS.info },
  { value: 'admin', label: ROLE_LABELS.admin },
];

const ACTIVE_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'true', label: 'Активные' },
  { value: 'false', label: 'Неактивные' },
] as const;

export const UserList = () => {
  const [role, setRole] = useState<RoleCode | 'all'>('all');
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reset, setReset] = useState<{ login: string; pw: string } | null>(null);
  const qc = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { role, active, search }],
    queryFn: () =>
      listUsers({
        ...(role !== 'all' && { roleCode: role }),
        ...(active !== 'all' && { isActive: active === 'true' }),
        ...(search.trim() && { search: search.trim() }),
      }),
  });

  const toggleActive = useMutation({
    mutationFn: (u: UserDto) => updateUser(u.id, { isActive: !u.isActive }),
    onSuccess: (_d, u) => {
      toast.success(u.isActive ? 'Пользователь деактивирован' : 'Пользователь активирован');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const resetMutation = useMutation({
    mutationFn: (u: UserDto) =>
      resetUserPassword(u.id).then((r): { login: string; resp: ResetPasswordResponse } => ({
        login: u.login,
        resp: r,
      })),
    onSuccess: ({ login, resp }) => {
      setReset({ login, pw: resp.temporaryPassword });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <Input
            placeholder="Поиск по логину…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Combobox
          className="w-[200px]"
          value={role}
          onChange={(v) => setRole(v as RoleCode | 'all')}
          options={[...ROLE_FILTERS]}
          placeholder="Все роли"
          clearable={false}
          aria-label="Фильтр по роли"
        />
        <Combobox
          className="w-[160px]"
          value={active}
          onChange={(v) => setActive(v as typeof active)}
          options={[...ACTIVE_FILTERS]}
          placeholder="Все"
          clearable={false}
          aria-label="Фильтр по активности"
        />
      </div>

      <div className="rounded-md border border-[var(--color-border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Логин</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading ? (
              skeletonKeys(4).map((k) => (
                <TableRow key={k}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : usersQuery.data && usersQuery.data.length > 0 ? (
              usersQuery.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-[family-name:var(--font-mono)] font-bold">
                    {u.login}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[u.roleCode]}</TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Отключён</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(u);
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Роль
                      </Button>
                      <ConfirmDangerDialog
                        trigger={
                          <Button size="sm" variant="outline">
                            <Power className="mr-1 h-3.5 w-3.5" />
                            {u.isActive ? 'Отключить' : 'Включить'}
                          </Button>
                        }
                        title={
                          u.isActive ? 'Деактивировать пользователя?' : 'Активировать пользователя?'
                        }
                        description={`Логин: ${u.login}`}
                        confirmLabel={u.isActive ? 'Деактивировать' : 'Активировать'}
                        variant={u.isActive ? 'destructive' : 'default'}
                        isLoading={toggleActive.isPending}
                        onConfirm={() => toggleActive.mutateAsync(u)}
                      />
                      <ConfirmDangerDialog
                        trigger={
                          <Button size="sm" variant="outline">
                            <KeyRound className="mr-1 h-3.5 w-3.5" />
                            Сброс пароля
                          </Button>
                        }
                        title="Сбросить пароль?"
                        description={`Новый временный пароль для «${u.login}» будет показан один раз.`}
                        confirmLabel="Сбросить"
                        isLoading={resetMutation.isPending}
                        onConfirm={() => resetMutation.mutateAsync(u)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[var(--color-muted-fg)]">
                  Нет пользователей.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditUserRoleDialog user={editing} open={editOpen} onOpenChange={setEditOpen} />
      <TempPasswordDialog
        open={reset !== null}
        onOpenChange={(v) => !v && setReset(null)}
        temporaryPassword={reset?.pw ?? null}
        login={reset?.login ?? null}
      />
    </div>
  );
};
