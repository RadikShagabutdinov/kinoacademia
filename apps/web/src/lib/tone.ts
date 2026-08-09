/**
 * Цвет знакового значения рейтинга: плюс — успех, минус — опасность, ноль — приглушённый.
 * Вынесено из карточек рейтинга и лент истории, где эта тройка повторялась дословно.
 */
export const signedTone = (value: number): string => {
  if (value > 0) return 'text-[var(--color-success)]';
  if (value < 0) return 'text-[var(--color-destructive)]';
  return 'text-[var(--color-subtle-fg)]';
};

/** Значение со знаком: `+50`, `−90`, `0`. Минус — типографский, как в макете. */
export const formatSigned = (value: number): string => {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
};

/** Разделитель разрядов узким пробелом — так набраны все суммы в макете (1 240). */
export const formatAmount = (value: number): string =>
  new Intl.NumberFormat('ru-RU').format(value).replace(/ /g, ' ');
