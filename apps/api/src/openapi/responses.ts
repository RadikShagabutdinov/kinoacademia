import type { z } from '@hono/zod-openapi';
import { ApiError } from '@kinoacademia/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Ответ с ошибкой в едином формате.
 *
 * Дженерик по статусу принципиален: если объявить `status` объединением
 * (`400 | 404 | 409`), возвращаемый тип унесёт всё объединение в `_status`,
 * и `@hono/zod-openapi` не сможет сопоставить его с конкретным ответом роута.
 * С дженериком статус сужается до фактического на каждом вызове.
 */
export const apiError = <S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  body: z.infer<typeof ApiError>,
) => c.json(body, status);

export const errorResponses = {
  400: {
    description: 'Validation error',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'validation_error',
          message: 'Request validation failed',
          details: { fieldErrors: [] },
        },
      },
    },
  },
  401: {
    description: 'Unauthorized',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'unauthorized',
          message: 'Missing or invalid access token',
        },
      },
    },
  },
  403: {
    description: 'Forbidden',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'forbidden',
          message: 'Insufficient permissions',
        },
      },
    },
  },
  404: {
    description: 'Not found',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'not_found',
          message: 'Resource not found',
        },
      },
    },
  },
  501: {
    description: 'Not implemented',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'internal_error',
          message: 'Percent mode is not implemented yet',
        },
      },
    },
  },
  409: {
    description: 'Conflict',
    content: {
      'application/json': {
        schema: ApiError.openapi('ApiError'),
        example: {
          code: 'conflict',
          message: 'Resource already exists or state conflict',
          details: { contractCode: 'invalid_transition' },
        },
      },
    },
  },
} as const;
