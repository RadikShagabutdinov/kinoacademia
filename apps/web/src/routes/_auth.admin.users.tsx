import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { CreateUserDialog } from '@/components/features/admin/users/CreateUserDialog';
import { UserList } from '@/components/features/admin/users/UserList';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/users')({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return (
    <AdminLayout
      title="Пользователи"
      description="Аккаунты участников, роли и сброс паролей."
      actions={<CreateUserDialog />}
    >
      <UserList />
    </AdminLayout>
  );
}
