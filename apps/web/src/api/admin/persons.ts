import { api } from '@/api/client';
import type {
  AdminPersonDto,
  CreatePersonInput,
  PersonDossierDto,
  UpdatePersonInput,
} from '@kinoacademia/shared';

export type ListPersonsFilter = {
  isOpen?: boolean;
  userId?: string;
};

export const listAdminPersons = (filter: ListPersonsFilter = {}): Promise<AdminPersonDto[]> => {
  const params = new URLSearchParams();
  if (filter.isOpen !== undefined) params.set('isOpen', String(filter.isOpen));
  if (filter.userId) params.set('userId', filter.userId);
  const qs = params.toString();
  return api.get<AdminPersonDto[]>(`/admin/persons${qs ? `?${qs}` : ''}`);
};

export const createPerson = (input: CreatePersonInput): Promise<AdminPersonDto> =>
  api.post<AdminPersonDto>('/admin/persons', input);

export const getPerson = (id: string): Promise<AdminPersonDto> =>
  api.get<AdminPersonDto>(`/admin/persons/${id}`);

export const updatePerson = (id: string, input: UpdatePersonInput): Promise<AdminPersonDto> =>
  api.patch<AdminPersonDto>(`/admin/persons/${id}`, input);

export const getPersonDossier = (id: string): Promise<PersonDossierDto> =>
  api.get<PersonDossierDto>(`/admin/persons/${id}/dossier`);
