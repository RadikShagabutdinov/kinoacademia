import type { LoginInput, MeDto } from '@kinoacademia/shared';
import { api } from './client';

export const getMe = (): Promise<MeDto> => api.get<MeDto>('/auth/me');

export const login = (input: LoginInput): Promise<MeDto['user']> =>
  api.post<MeDto['user']>('/auth/login', input);

export const logout = (): Promise<{ ok: true }> => api.post<{ ok: true }>('/auth/logout');

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true }> => api.post<{ ok: true }>('/auth/change-password', input);
