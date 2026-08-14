import { getApiErrorMessage, parseApiError } from '@/lib/apiError';

const FILM_ERROR_MESSAGES: Record<string, string> = {
  film_not_found: 'Фильм не найден',
  company_not_found: 'Компания не найдена',
  not_cinema: 'Компания не является кинокомпанией',
  person_not_found: 'Персонаж не найден',
  duplicate_assignment: 'уже назначен на эту роль',
  assignment_not_found: 'Участник не найден',
  assignment_nominated: 'у участника есть номинация на этот фильм',
};

/**
 * Человекочитаемое сообщение по `details.filmCode` из ApiError:
 * бэкенд отвечает англоязычным `message`, а игрокам нужен русский текст.
 */
export const getFilmErrorMessage = (err: unknown, fallback: string): string => {
  const details = parseApiError(err)?.details;
  const code =
    details && typeof details === 'object' && 'filmCode' in details
      ? (details as { filmCode: unknown }).filmCode
      : undefined;
  const message = typeof code === 'string' ? FILM_ERROR_MESSAGES[code] : undefined;
  return message ?? getApiErrorMessage(err, fallback);
};
