import type { ApiError } from '@kinoacademia/shared';
import type { Context } from 'hono';
import { RatingError, ratingErrorStatus } from '../modules/ratings/errors';

/**
 * Единая трансляция доменной ошибки рейтинга в HTTP-ответ. Не-`RatingError`
 * пробрасывается дальше — это ошибка приложения, а не игровое правило.
 */
export const handleRatingError = (c: Context, err: unknown) => {
  if (err instanceof RatingError) {
    const status = ratingErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404
        ? 'not_found'
        : status === 409
          ? 'conflict'
          : status === 501
            ? 'internal_error'
            : 'validation_error';
    const body = {
      code: apiCode,
      message: err.message,
      details: { ratingCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам обязательно: c.json(body, <union>) склеивает
    // статусы в одно поле _status, и ответ перестаёт подходить под роут.
    switch (status) {
      case 400:
        return c.json(body, 400);
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
      case 501:
        return c.json(body, 501);
    }
  }
  throw err;
};
