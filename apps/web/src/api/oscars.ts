import type {
  CreateOscarNominationInput,
  OscarDto,
  OscarNominationDetailDto,
} from '@kinoacademia/shared';
import { api } from './client';

export const listAllOscars = (): Promise<OscarNominationDetailDto[]> =>
  api.get<OscarNominationDetailDto[]>('/oscars');

export const listCompanyOscars = (companyId: string): Promise<OscarNominationDetailDto[]> =>
  api.get<OscarNominationDetailDto[]>(`/oscars/company/${companyId}`);

export const listPersonOscars = (personId: string): Promise<OscarNominationDetailDto[]> =>
  api.get<OscarNominationDetailDto[]>(`/oscars/person/${personId}`);

export const listFilmOscars = (filmId: string): Promise<OscarNominationDetailDto[]> =>
  api.get<OscarNominationDetailDto[]>(`/oscars/film/${filmId}`);

export const submitNomination = (input: CreateOscarNominationInput): Promise<OscarDto> =>
  api.post<OscarDto>('/oscars/nominations', input);

export const awardOscar = (id: string): Promise<OscarDto> =>
  api.post<OscarDto>(`/admin/oscars/${id}/award`, {});
