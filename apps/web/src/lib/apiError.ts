import { type ApiError, ApiError as ApiErrorSchema } from '@kinoacademia/shared';

type FetchErrorLike = {
  data?: unknown;
};

/**
 * Извлекает тело ApiError из исключения ofetch.
 * @param err — ошибка из catch после HTTP-запроса
 * @returns распарсенный ApiError или null
 */
export const parseApiError = (err: unknown): ApiError | null => {
  if (!err || typeof err !== 'object') return null;
  const data = (err as FetchErrorLike).data;
  const parsed = ApiErrorSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

/**
 * Возвращает человекочитаемое сообщение из ApiError или fallback.
 * @param err — ошибка из catch
 * @param fallback — текст по умолчанию
 */
export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const apiError = parseApiError(err);
  if (apiError?.message) return apiError.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};
