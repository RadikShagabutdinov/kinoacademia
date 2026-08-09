import { api } from '@/api/client';
import type {
  CompanyRatingDto,
  ManualRatingInput,
  PersonRatingDto,
  RatingTransactionDto,
} from '@kinoacademia/shared';

export type ManualTransactionResponse =
  | { rating: PersonRatingDto; transaction: RatingTransactionDto }
  | { rating: CompanyRatingDto; transaction: RatingTransactionDto };

export const createManualTransaction = (
  input: ManualRatingInput,
): Promise<ManualTransactionResponse> =>
  api.post<ManualTransactionResponse>('/admin/transactions', input);
