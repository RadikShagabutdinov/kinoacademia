import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from 'hono';
import type { AuthVariables } from '../auth/middleware';

export type AuthEnv = { Variables: AuthVariables };

/**
 * Приложение с общим обработчиком ошибок валидации. Параметр типа нужен,
 * чтобы роуты видели свой `Variables` в контексте — без него дженерики
 * схлопываются и обработчики перестают типизироваться.
 */
export const createOpenAPIApp = <E extends Env = AuthEnv>() => {
  return new OpenAPIHono<E>({
    defaultHook: (result, c) => {
      // Возврат обязателен на обеих ветках: иначе TS считает,
      // что функция не всегда возвращает значение (noImplicitReturns).
      if (result.success) return undefined;
      return c.json(
        {
          code: 'validation_error',
          message: 'Request validation failed',
          details: result.error.flatten(),
        },
        400,
      );
    },
  });
};

export const securitySchemes = {
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'ka_access',
    description: 'HttpOnly cookie with JWT access token',
  },
} as const;
