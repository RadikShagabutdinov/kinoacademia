import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { CreatePersonDialog } from '@/components/features/admin/persons/CreatePersonDialog';
import { PersonsList } from '@/components/features/admin/persons/PersonsList';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/persons/')({
  component: AdminPersonsPage,
});

function AdminPersonsPage() {
  return (
    <AdminLayout
      title="Персонажи"
      description="Игровые персонажи: создание, открытие и закрытие, привязка к пользователям."
      actions={<CreatePersonDialog />}
    >
      <PersonsList />
    </AdminLayout>
  );
}
