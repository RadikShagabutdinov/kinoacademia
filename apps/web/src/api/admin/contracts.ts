import { api } from '@/api/client';
import type { ContractDto, ForceBreakContractInput } from '@kinoacademia/shared';

export const listActiveAdminContracts = (): Promise<ContractDto[]> =>
  api.get<ContractDto[]>('/admin/contracts');

export const forceBreakContract = (
  kind: ContractDto['kind'],
  id: string,
  input: ForceBreakContractInput,
): Promise<ContractDto> =>
  api.post<ContractDto>(`/admin/contracts/${kind}/${id}/force-break`, input);
