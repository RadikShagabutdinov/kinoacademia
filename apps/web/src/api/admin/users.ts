import { api } from '@/api/client';
import type {
  CreateUserInput,
  CreateUserResponse,
  ResetPasswordResponse,
  RoleCode,
  UpdateUserInput,
  UserDto,
} from '@kinoacademia/shared';

export type ListUsersFilter = {
  roleCode?: RoleCode;
  isActive?: boolean;
  search?: string;
};

export const listUsers = (filter: ListUsersFilter = {}): Promise<UserDto[]> => {
  const params = new URLSearchParams();
  if (filter.roleCode) params.set('roleCode', filter.roleCode);
  if (filter.isActive !== undefined) params.set('isActive', String(filter.isActive));
  if (filter.search) params.set('search', filter.search);
  const qs = params.toString();
  return api.get<UserDto[]>(`/admin/users${qs ? `?${qs}` : ''}`);
};

export const createUser = (input: CreateUserInput): Promise<CreateUserResponse> =>
  api.post<CreateUserResponse>('/admin/users', input);

export const updateUser = (id: string, input: UpdateUserInput): Promise<UserDto> =>
  api.patch<UserDto>(`/admin/users/${id}`, input);

export const resetUserPassword = (id: string): Promise<ResetPasswordResponse> =>
  api.post<ResetPasswordResponse>(`/admin/users/${id}/reset-password`);
