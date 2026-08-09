import { InfoSubNav } from '@/components/features/info/InfoSubNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { meQueryOptions } from '@/hooks/useMe';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/info')({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me.user.roleCode !== 'info' && me.user.roleCode !== 'admin') {
      throw redirect({ to: '/no-access' });
    }
    if (location.pathname === '/info' || location.pathname === '/info/') {
      throw redirect({ to: '/info/ratings' });
    }
  },
  component: InfoLayout,
});

function InfoLayout() {
  return (
    // min-h-0 обязателен: без него flex-элемент не даёт вложенной таблице скроллиться.
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Мониторы" description="Сводная информация по игре в реальном времени." />

      <InfoSubNav />

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
