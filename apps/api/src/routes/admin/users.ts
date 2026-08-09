import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  CreateUserInput,
  CreateUserResponse,
  ResetPasswordResponse,
  RoleCode,
  UpdateUserInput,
  UserDto,
} from '@kinoacademia/shared';
import type { AuthVariables } from '../../auth/middleware';
import { requireAuth, requireRole } from '../../auth/middleware';
import { hashPassword } from '../../auth/password';
import { writeAudit } from '../../modules/audit/audit-repo';
import {
  createUser,
  findUserById,
  findUserByLogin,
  listUsers,
  toUserDto,
  updateUser,
} from '../../modules/users/users-repo';
import { createOpenAPIApp } from '../../openapi/app';
import { apiError, errorResponses } from '../../openapi/responses';

const TEMP_PASSWORD_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TEMP_PASSWORD_LENGTH = 12;

const generateTempPassword = (): string => {
  const array = new Uint8Array(TEMP_PASSWORD_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length])
    .join('');
};

const ListUsersQuery = z.object({
  roleCode: RoleCode.optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

const UserIdParam = z.object({
  id: z.string().uuid(),
});

const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['admin'],
  summary: 'List users',
  description:
    'List all users with optional filters by roleCode, isActive status, and login search. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    query: ListUsersQuery,
  },
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(UserDto).openapi('UserList'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['admin'],
  summary: 'Create user',
  description:
    'Create a new user with login and role. Returns user data and temporary password. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserInput.openapi('CreateUserInput'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: CreateUserResponse.openapi('CreateUserResponse'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
  },
});

const updateUserRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['admin'],
  summary: 'Update user',
  description: 'Update user roleCode and/or isActive status. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: UserIdParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateUserInput.openapi('UpdateUserInput'),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated successfully',
      content: {
        'application/json': {
          schema: UserDto.openapi('UserDto'),
        },
      },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/:id/reset-password',
  tags: ['admin'],
  summary: 'Reset user password',
  description:
    'Generate and set a new temporary password for user. Returns temporary password. Admin role required.',
  security: [{ cookieAuth: [] }],
  request: {
    params: UserIdParam,
  },
  responses: {
    200: {
      description: 'Password reset successfully',
      content: {
        'application/json': {
          schema: ResetPasswordResponse.openapi('ResetPasswordResponse'),
        },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const adminUsersRoutes = createOpenAPIApp();

adminUsersRoutes.use('*', requireAuth, requireRole('admin'));

adminUsersRoutes.openapi(listUsersRoute, async (c) => {
  const { roleCode, isActive: isActiveStr, search } = c.req.valid('query');

  const isActive = isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;

  const rows = await listUsers({
    ...(roleCode !== undefined && { roleCode }),
    ...(isActive !== undefined && { isActive }),
    ...(search && { search }),
  });

  return c.json(rows.map(toUserDto), 200);
});

adminUsersRoutes.openapi(createUserRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { login, roleCode } = c.req.valid('json');

  const existing = await findUserByLogin(login);
  if (existing) {
    return apiError(c, 409, { code: 'conflict', message: 'User with this login already exists' });
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await createUser({ login, passwordHash, roleCode });

  await writeAudit({
    actorUserId: actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: user.id,
    payload: { login, roleCode },
  });

  return c.json({ user: toUserDto(user), temporaryPassword }, 201);
});

adminUsersRoutes.openapi(updateUserRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { id } = c.req.valid('param');
  const data = c.req.valid('json');

  if (Object.keys(data).length === 0) {
    return apiError(c, 400, { code: 'validation_error', message: 'No fields to update' });
  }

  const updated = await updateUser(id, {
    ...(data.roleCode !== undefined && { roleCode: data.roleCode }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
  });
  if (!updated) {
    return c.json({ code: 'not_found', message: 'User not found' } satisfies ApiError, 404);
  }

  await writeAudit({
    actorUserId: actor.id,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    payload: data,
  });

  return c.json(toUserDto(updated), 200);
});

adminUsersRoutes.openapi(resetPasswordRoute, async (c) => {
  const actor = c.get('user') as AuthVariables['user'];
  const { id } = c.req.valid('param');

  const user = await findUserById(id);
  if (!user) {
    return c.json({ code: 'not_found', message: 'User not found' } satisfies ApiError, 404);
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await updateUser(id, { passwordHash, mustChangePassword: true });

  await writeAudit({
    actorUserId: actor.id,
    action: 'user.reset_password',
    entityType: 'user',
    entityId: id,
  });

  return c.json({ temporaryPassword }, 200);
});
