import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from '@/components/ui/sonner';
import { meQueryOptions, useMe } from '@/hooks/useMe';
import { useWsChannel } from '@/hooks/useWs';
import {
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { useCallback } from 'react';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions);
      if (me.user.mustChangePassword && !location.pathname.endsWith('/change-password')) {
        throw redirect({ to: '/change-password' });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const onSystemEvent = useCallback(
    (event: { type: string; payload: unknown }) => {
      if (me?.user.roleCode !== 'admin' || event.type !== 'job.finished') return;
      const payload = event.payload as { jobKey?: string; status?: string; error?: string };
      if (payload.status === 'failed') {
        toast.error(`Задача ${payload.jobKey ?? ''} завершилась с ошибкой`, {
          description: payload.error,
        });
        return;
      }
      if (payload.status === 'success') {
        toast.success(`Задача ${payload.jobKey ?? ''} выполнена`);
      }
    },
    [me?.user.roleCode],
  );

  useWsChannel(me?.user.roleCode === 'admin' ? 'system' : null, onSystemEvent);

  if (!me) return null;
  if (me.user.mustChangePassword && !pathname.endsWith('/change-password')) return null;

  return (
    <AppLayout me={me}>
      <Outlet />
    </AppLayout>
  );
}
