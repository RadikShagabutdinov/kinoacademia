import type { AllRatingsResponse } from '@/api/ratings';
import type { PersonRatingAdminDto } from '@kinoacademia/shared';
import { api } from '../client';

/** То же, что `/ratings/all`, но с полной разбивкой персонажей (сырая база + модификатор). */
export type AdminAllRatingsResponse = Omit<AllRatingsResponse, 'persons'> & {
  persons: PersonRatingAdminDto[];
};

export const getAdminAllRatings = (): Promise<AdminAllRatingsResponse> =>
  api.get<AdminAllRatingsResponse>('/admin/ratings/all');
