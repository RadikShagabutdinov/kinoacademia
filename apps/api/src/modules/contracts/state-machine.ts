import { type ContractStatusCode, canTransition } from '@kinoacademia/shared';
import { ContractError } from './errors';

export const assertTransition = (from: ContractStatusCode, to: ContractStatusCode): void => {
  if (!canTransition(from, to)) {
    throw new ContractError(
      'invalid_transition',
      `Cannot transition contract from "${from}" to "${to}"`,
    );
  }
};
