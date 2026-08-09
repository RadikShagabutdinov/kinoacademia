import { listOpenPersons } from '@/api/persons';
import type { PersonDto } from '@kinoacademia/shared';
import { queryOptions, useQuery } from '@tanstack/react-query';

export const openPersonsQueryOptions = queryOptions<PersonDto[]>({
  queryKey: ['persons', 'open'],
  queryFn: listOpenPersons,
  staleTime: 60_000,
});

export const useOpenPersons = () => useQuery(openPersonsQueryOptions);
