import type { ContractErrorCode } from '@kinoacademia/shared';

export class ContractError extends Error {
  constructor(
    public readonly code: ContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export const contractErrorStatus = (code: ContractErrorCode): 403 | 404 | 409 => {
  switch (code) {
    case 'contract_not_found':
      return 404;
    case 'forbidden':
      return 403;
    default:
      return 409;
  }
};
