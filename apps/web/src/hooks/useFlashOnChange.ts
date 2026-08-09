import { useEffect, useRef, useState } from 'react';

/**
 * Возвращает true на ~durationMs после каждого изменения value.
 * Используется для подсветки строки лидерборда при обновлении значения.
 */
export const useFlashOnChange = <T>(value: T, durationMs = 700): boolean => {
  const prevRef = useRef<T>(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), durationMs);
    return () => clearTimeout(t);
  }, [value, durationMs]);

  return flash;
};
