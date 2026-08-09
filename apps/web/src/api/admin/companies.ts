import { api } from '@/api/client';
import type {
  BranchCode,
  CompanyDto,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '@kinoacademia/shared';

export const listAdminCompanies = (branchCode?: BranchCode): Promise<CompanyDto[]> => {
  const qs = branchCode ? `?branchCode=${branchCode}` : '';
  return api.get<CompanyDto[]>(`/admin/companies${qs}`);
};

export const getAdminCompany = (id: string): Promise<CompanyDto> =>
  api.get<CompanyDto>(`/admin/companies/${id}`);

export const createAdminCompany = (input: CreateCompanyInput): Promise<CompanyDto> =>
  api.post<CompanyDto>('/admin/companies', input);

export const updateAdminCompany = (id: string, input: UpdateCompanyInput): Promise<CompanyDto> =>
  api.patch<CompanyDto>(`/admin/companies/${id}`, input);
