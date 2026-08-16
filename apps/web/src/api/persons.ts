import type { PersonDto } from '@kinoacademia/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export const listOpenPersons = (): Promise<PersonDto[]> => api.get<PersonDto[]>('/persons');

export const openPersonsQueryOptions = queryOptions<PersonDto[]>({
  queryKey: ['persons', 'open'],
  queryFn: listOpenPersons,
  staleTime: 60_000,
});
