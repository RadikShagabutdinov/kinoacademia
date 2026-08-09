import type {
  BranchCode,
  CompanyRatingDto,
  PersonRatingDto,
  PersonRatingSummaryDto,
  RatingTransactionDto,
  RatingTxKind,
  TransferRatingInput,
} from '@kinoacademia/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './client';

export type AdmireResponse = {
  donor: PersonRatingDto;
  transaction: RatingTransactionDto;
};

export type CompanyRatingResponse = {
  rating: CompanyRatingDto;
  history: RatingTransactionDto[];
};

export const getCompanyRating = (companyId: string): Promise<CompanyRatingResponse> =>
  api.get<CompanyRatingResponse>(`/ratings/company/${companyId}`);

export const getMyRating = (): Promise<PersonRatingDto> => api.get<PersonRatingDto>('/ratings/me');

export const getPersonRatingSummary = (personId: string): Promise<PersonRatingSummaryDto> =>
  api.get<PersonRatingSummaryDto>(`/ratings/person/${personId}/summary`);

export type HistoryFilter = {
  limit?: number;
  kind?: RatingTxKind;
};

export const getMyRatingHistory = (filter: HistoryFilter = {}): Promise<RatingTransactionDto[]> => {
  const params = new URLSearchParams();
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.kind !== undefined) params.set('kind', filter.kind);
  const qs = params.toString();
  return api.get<RatingTransactionDto[]>(`/ratings/me/history${qs ? `?${qs}` : ''}`);
};

export const admire = (input: TransferRatingInput): Promise<AdmireResponse> =>
  api.post<AdmireResponse>('/ratings/me/admire', input);

export type AllRatingsResponse = {
  persons: PersonRatingDto[];
  companies: CompanyRatingDto[];
  personNames: Record<string, { displayName: string }>;
  companyNames: Record<string, { name: string; branchCode: BranchCode }>;
};

export const getAllRatings = (): Promise<AllRatingsResponse> =>
  api.get<AllRatingsResponse>('/ratings/all');

export const allRatingsQueryOptions = queryOptions<AllRatingsResponse>({
  queryKey: ['ratings', 'all'],
  queryFn: getAllRatings,
  staleTime: 15_000,
});
