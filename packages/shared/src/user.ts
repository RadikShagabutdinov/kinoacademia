import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';
import { PersonDto } from './person';
import { RoleCode } from './roles';

export const Login = z
  .string()
  .min(3)
  .max(64)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Login may contain only latin letters, digits, dot, underscore or dash',
  );
export const Password = z.string().min(8).max(128);

export const LoginInput = z.object({
  login: Login,
  password: Password,
});
export type LoginInput = z.infer<typeof LoginInput>;

export const UserDto = z.object({
  id: Uuid,
  login: Login,
  roleCode: RoleCode,
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type UserDto = z.infer<typeof UserDto>;

export const ChangePasswordInput = z.object({
  currentPassword: Password,
  newPassword: Password,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;

export const CreateUserInput = z.object({
  login: Login,
  roleCode: RoleCode,
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  roleCode: RoleCode.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;

export const CreateUserResponse = z.object({
  user: UserDto,
  temporaryPassword: z.string(),
});
export type CreateUserResponse = z.infer<typeof CreateUserResponse>;

export const ResetPasswordResponse = z.object({
  temporaryPassword: z.string(),
});
export type ResetPasswordResponse = z.infer<typeof ResetPasswordResponse>;

export const MeDto = z.object({
  user: UserDto,
  person: PersonDto.nullable(),
});
export type MeDto = z.infer<typeof MeDto>;
