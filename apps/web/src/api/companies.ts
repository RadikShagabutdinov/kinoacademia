import type { CompanyDto } from '@kinoacademia/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export const getCompanyById = (id: string): Promise<CompanyDto> =>
  api.get<CompanyDto>(`/companies/${id}`);

export const getMyCompany = (): Promise<CompanyDto> => api.get<CompanyDto>('/companies/my');

// retry: false — у руководителя может не быть компании, и повторять 404 незачем.
export const myCompanyQueryOptions = queryOptions<CompanyDto>({
  queryKey: ['companies', 'my'],
  queryFn: getMyCompany,
  staleTime: 60_000,
  retry: false,
});
