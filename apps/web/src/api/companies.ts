import type {
  CompanyDto,
  CompanyPaymentInput,
  CompanyRatingDto,
  PersonRatingDto,
  RatingTransactionDto,
} from '@kinoacademia/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export const getCompanyById = (id: string): Promise<CompanyDto> =>
  api.get<CompanyDto>(`/companies/${id}`);

export const listCompanies = (): Promise<CompanyDto[]> => api.get<CompanyDto[]>('/companies');

export const companiesQueryOptions = queryOptions<CompanyDto[]>({
  queryKey: ['companies', 'all'],
  queryFn: listCompanies,
  staleTime: 60_000,
});

export type CompanyPaymentResult = {
  company: CompanyRatingDto;
  recipient: PersonRatingDto | CompanyRatingDto;
  transaction: RatingTransactionDto;
};

export const createCompanyPayment = (
  companyId: string,
  input: CompanyPaymentInput,
): Promise<CompanyPaymentResult> =>
  api.post<CompanyPaymentResult>(`/companies/${companyId}/payments`, input);

export const getMyCompany = (): Promise<CompanyDto> => api.get<CompanyDto>('/companies/my');

// retry: false — у руководителя может не быть компании, и повторять 404 незачем.
export const myCompanyQueryOptions = queryOptions<CompanyDto>({
  queryKey: ['companies', 'my'],
  queryFn: getMyCompany,
  staleTime: 60_000,
  retry: false,
});
