import { meQueryOptions } from '@/hooks/useMe';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/admin')({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me.user.roleCode !== 'admin') {
      throw redirect({ to: '/no-access' });
    }
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      throw redirect({ to: '/admin/users' });
    }
  },
  component: () => <Outlet />,
});
