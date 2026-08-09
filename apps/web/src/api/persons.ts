import type { PersonDto } from '@kinoacademia/shared';
import { api } from './client';

export const listOpenPersons = (): Promise<PersonDto[]> => api.get<PersonDto[]>('/persons');
