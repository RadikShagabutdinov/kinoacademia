import { getMe } from '@/api/auth';
import type { MeDto } from '@kinoacademia/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';

export const meQueryOptions = queryOptions<MeDto>({
  queryKey: ['auth', 'me'],
  queryFn: getMe,
  retry: false,
  staleTime: 60_000,
});

export const useMe = () => useQuery(meQueryOptions);
