import { api } from '@/api/client';
import type {
  CompanyRatingDto,
  ManualRatingInput,
  PersonRatingAdminDto,
  RatingTransactionDto,
} from '@kinoacademia/shared';

/** `source` заполнен, только если рейтинг брали не из админского ресурса. */
export type ManualTransactionResponse = {
  target: PersonRatingAdminDto | CompanyRatingDto;
  source: PersonRatingAdminDto | CompanyRatingDto | null;
  transaction: RatingTransactionDto;
};

export const createManualTransaction = (
  input: ManualRatingInput,
): Promise<ManualTransactionResponse> =>
  api.post<ManualTransactionResponse>('/admin/transactions', input);
