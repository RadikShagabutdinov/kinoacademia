/**
 * Размеры проекционного лидерборда. Всё в `clamp()` от `vw`: доска должна
 * читаться и на FullHD, и на 4K, поэтому фиксированные px (и `DisplayNumber`
 * из общих примитивов) здесь не годятся.
 *
 * Опорные значения взяты из макета для 1920×1080.
 */
export const DISPLAY_SCALE = {
  /** «СПАСИБО КИНОАКАДЕМИИ!» — надзаголовок шапки. */
  brand: 'clamp(11px, 0.78vw, 15px)',
  /** «Рейтинги» — заголовок экрана. */
  title: 'clamp(32px, 3.1vw, 60px)',
  /** Часы. */
  clock: 'clamp(24px, 2.3vw, 44px)',
  /** «Персонажи» / «Компании» — заголовки колонок. */
  boardTitle: 'clamp(18px, 1.56vw, 30px)',
  /** «ТОП-8 ИЗ 46» и заголовки столбцов. */
  columnLabel: 'clamp(10px, 0.73vw, 14px)',
  /** Номер строки. */
  rank: 'clamp(16px, 1.67vw, 32px)',
  /** Имя персонажа или компании. */
  name: 'clamp(14px, 1.35vw, 26px)',
  /** Итоговое число строки. */
  value: 'clamp(18px, 1.77vw, 34px)',
  /** Сноска внизу экрана. */
  footnote: 'clamp(10px, 0.73vw, 14px)',
} as const;

export type ColumnWidths = {
  /** Номер места. */
  rank: string;
  /** Имя персонажа или название компании — забирает остаток ширины. */
  name: string;
  /** Сфера компании. */
  branch: string;
  /** Итоговый рейтинг. */
  value: string;
  /** Изменение рейтинга со стрелкой и знаком. */
  delta: string;
};

/** Проектор: столбцы в `ch` — числа набраны одинаково широко и на FullHD, и на 4K. */
export const COLUMN_WIDTHS: ColumnWidths = {
  rank: '3ch',
  name: 'minmax(0, 1fr)',
  branch: '14ch',
  value: '12ch',
  delta: '10ch',
};

/**
 * Телефон: те же столбцы в `ch` занимают ~210px и не оставляют места имени,
 * поэтому фиксируем их в `rem` и ужимаем.
 */
export const NARROW_COLUMN_WIDTHS: ColumnWidths = {
  rank: '2rem',
  name: 'minmax(0, 1fr)',
  branch: '5.5rem',
  value: '4.2rem',
  delta: '4rem',
};

/**
 * Раскладка строки лидерборда: номер места плюс переданные ширины столбцов.
 * Шапка (`BoardShell`) и строки (`LeaderboardRow`) обязаны получать одни и те же ширины.
 */
export const gridTemplate = (rankWidth: string, widths: readonly string[]): string =>
  [rankWidth, ...widths].join(' ');
