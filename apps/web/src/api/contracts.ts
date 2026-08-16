import type {
  BranchCode,
  ContractActionInput,
  ContractDto,
  ContractKind,
  ContractStatusHistoryDto,
  CreateContractInput,
} from '@kinoacademia/shared';
import { api } from './client';

export type ContractsHistoryFilter = {
  companyId?: string;
  personId?: string;
  branchCode?: BranchCode;
  limit?: number;
};

export const getContractsHistory = (
  filter: ContractsHistoryFilter = {},
): Promise<ContractStatusHistoryDto[]> => {
  const params = new URLSearchParams();
  if (filter.companyId) params.set('companyId', filter.companyId);
  if (filter.personId) params.set('personId', filter.personId);
  if (filter.branchCode) params.set('branchCode', filter.branchCode);
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  const qs = params.toString();
  return api.get<ContractStatusHistoryDto[]>(`/contracts/history${qs ? `?${qs}` : ''}`);
};

export const getMyContracts = (): Promise<ContractDto[]> => api.get<ContractDto[]>('/contracts/my');

export const getCompanyContracts = (companyId: string): Promise<ContractDto[]> =>
  api.get<ContractDto[]>(`/contracts/company/${companyId}`);

export const createCompanyContract = (
  companyId: string,
  input: CreateContractInput,
): Promise<ContractDto> => api.post<ContractDto>(`/contracts/company/${companyId}`, input);

export type CompanyContractActionParams = {
  companyId: string;
  kind: ContractKind;
  id: string;
  comment?: string;
};

const companyActionUrl = (action: string, p: CompanyContractActionParams) =>
  `/contracts/company/${p.companyId}/${p.kind}/${p.id}/${action}`;

const companyActionBody = (p: CompanyContractActionParams): ContractActionInput =>
  p.comment !== undefined ? { comment: p.comment } : {};

export const submitCompanyContract = (p: CompanyContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(companyActionUrl('submit', p), companyActionBody(p));

export const breakCompanyContract = (p: CompanyContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(companyActionUrl('break', p), companyActionBody(p));

export const requestEndCompanyContract = (p: CompanyContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(companyActionUrl('request-end', p), companyActionBody(p));

export const confirmEndCompanyContract = (p: CompanyContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(companyActionUrl('confirm-end', p), companyActionBody(p));

export const rejectEndCompanyContract = (p: CompanyContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(companyActionUrl('reject-end', p), companyActionBody(p));

export type ContractActionParams = {
  kind: ContractKind;
  id: string;
  comment?: string;
};

const actionUrl = (action: string, p: ContractActionParams) =>
  `/contracts/my/${p.kind}/${p.id}/${action}`;

const body = (p: ContractActionParams): ContractActionInput =>
  p.comment !== undefined ? { comment: p.comment } : {};

export const confirmContract = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('confirm', p), body(p));

export const rejectContract = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('reject', p), body(p));

export const breakContract = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('break', p), body(p));

export const requestContractEnd = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('request-end', p), body(p));

export const confirmContractEnd = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('confirm-end', p), body(p));

export const rejectContractEnd = (p: ContractActionParams): Promise<ContractDto> =>
  api.post<ContractDto>(actionUrl('reject-end', p), body(p));
