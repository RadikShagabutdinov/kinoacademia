import { myCompanyQueryOptions } from '@/api/companies';
import { CompanySubNav } from '@/components/features/company/CompanySubNav';
import { NoticeBox } from '@/components/ui/notice-box';
import { meQueryOptions } from '@/hooks/useMe';
import { useQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/company')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me.user.roleCode !== 'head') {
      throw redirect({ to: '/no-access' });
    }
  },
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(myCompanyQueryOptions);
    } catch {
      // Компания может быть не назначена — отрисуем заглушку в компоненте.
    }
  },
  component: CompanyLayout,
});

function CompanyLayout() {
  const { data: company, isPending } = useQuery(myCompanyQueryOptions);

  if (isPending) return null;

  if (!company) {
    return (
      <NoticeBox tone="muted">
        Компания не назначена. Дождитесь, пока администратор привяжет вас к компании.
      </NoticeBox>
    );
  }

  // Заголовок раздела рисует сама подстраница — так в макете над ним стоит
  // надзаголовок с названием компании, а справа живёт кнопка действия.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CompanySubNav branchCode={company.branchCode} />

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
