import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { CompanyList } from '@/components/features/admin/companies/CompanyList';
import { CreateCompanyDialog } from '@/components/features/admin/companies/CreateCompanyDialog';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin/companies')({
  component: AdminCompaniesPage,
});

function AdminCompaniesPage() {
  return (
    <AdminLayout
      title="Компании"
      description="Создание и редактирование компаний игры."
      actions={<CreateCompanyDialog />}
    >
      <CompanyList />
    </AdminLayout>
  );
}
