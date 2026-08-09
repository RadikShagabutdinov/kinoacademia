import { EventEmitter } from 'node:events';
import type { ContractKind, ContractStatusCode } from '@kinoacademia/shared';

export type ContractUpdated = {
  contractId: string;
  kind: ContractKind;
  personId: string;
  companyId: string;
  fromStatus: ContractStatusCode | null;
  toStatus: ContractStatusCode;
};

type ContractsEvents = {
  'contract.updated': [ContractUpdated];
};

export const contractsEmitter = new EventEmitter<ContractsEvents>();
