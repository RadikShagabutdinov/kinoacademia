import { allRatingsQueryOptions } from '@/api/ratings';
import {
  type DisplayLayout,
  DisplayLeaderboard,
  type DisplayLimit,
} from '@/components/features/display/DisplayLeaderboard';
import { meQueryOptions } from '@/hooks/useMe';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  layout: z.enum(['two-columns', 'rotate', 'persons', 'companies']).default('two-columns'),
  limit: z.enum(['top10', 'all']).default('all'),
  interval: z.coerce.number().int().min(2).max(120).default(10),
});

export const Route = createFileRoute('/display/leaderboard')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions).catch(() => {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    });
    if (me.user.roleCode !== 'info' && me.user.roleCode !== 'admin') {
      throw redirect({ to: '/no-access' });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(allRatingsQueryOptions),
  component: DisplayLeaderboardPage,
});

function DisplayLeaderboardPage() {
  const { layout, limit, interval } = Route.useSearch() as {
    layout: DisplayLayout;
    limit: DisplayLimit;
    interval: number;
  };
  return <DisplayLeaderboard layout={layout} limit={limit} intervalSec={interval} />;
}
