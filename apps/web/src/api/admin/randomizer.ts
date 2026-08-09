import { api } from '@/api/client';
import type { PersonRatingAdminDto, RandomizerApplyInput } from '@kinoacademia/shared';

export const applyRandomizer = (input: RandomizerApplyInput): Promise<PersonRatingAdminDto[]> =>
  api.post<PersonRatingAdminDto[]>('/admin/randomizer', input);

export const cancelRandomizer = (): Promise<PersonRatingAdminDto[]> =>
  api.delete<PersonRatingAdminDto[]>('/admin/randomizer');
