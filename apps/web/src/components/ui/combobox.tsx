import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { type KeyboardEvent, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
};

type Props = {
  /** Пустая строка — значение не выбрано. */
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  /** Подпись на кнопке без выбранного значения; она же — пункт сброса в списке. */
  placeholder: string;
  /** Поиск появляется, когда опций больше порога. */
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Крестик сброса в кнопке и пункт-плейсхолдер в списке. */
  clearable?: boolean;
  className?: string;
  /** Ставится на кнопку-триггер, чтобы работал внешний `<Label htmlFor>`. */
  id?: string;
  'aria-label'?: string;
};

/**
 * Селект-фильтр в стиле приложения: поиск по длинным спискам и сброс значения
 * прямо в кнопке. Нативный `<select>` (`ui/native-select.tsx`) остаётся для форм,
 * где важен системный пикер на мобильных.
 */
export const Combobox = ({
  value,
  onChange,
  options,
  placeholder,
  searchThreshold = 8,
  searchPlaceholder = 'Поиск…',
  emptyText = 'Ничего не найдено',
  clearable = true,
  className,
  id,
  'aria-label': ariaLabel,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const withSearch = options.length > searchThreshold;
  const selected = options.find((o) => o.value === value);

  // Пункт-плейсхолдер идёт первым и работает как сброс, поэтому он часть списка
  // навигации: индексы стрелок считаются по этому же массиву.
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
    return clearable ? [{ value: '', label: placeholder }, ...filtered] : filtered;
  }, [options, query, clearable, placeholder]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const moveActive = (delta: number) => {
    if (items.length === 0) return;
    const next = (activeIndex + delta + items.length) % items.length;
    setActiveIndex(next);
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'Enter') {
      const item = items[activeIndex];
      if (item) {
        e.preventDefault();
        commit(item.value);
      }
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery('');
        setActiveIndex(Math.max(0, next ? items.findIndex((i) => i.value === value) : 0));
      }}
    >
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            aria-label={ariaLabel ?? placeholder}
            className="flex h-10 w-full items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input)] py-2 pl-3 pr-9 text-left text-sm font-semibold transition-colors hover:border-[var(--color-muted-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <span
              className={cn('truncate', !selected && 'font-normal text-[var(--color-muted-fg)]')}
            >
              {selected?.label ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>

        {clearable && value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Сбросить: ${placeholder}`}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted-fg)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-fg)]"
          />
        )}
      </div>

      <PopoverContent
        className="min-w-[var(--radix-popover-trigger-width)] max-w-[min(20rem,calc(100vw-2rem))]"
        onKeyDown={onKeyDown}
      >
        {withSearch && (
          <div className="relative p-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtle-fg)]"
            />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 pl-9 text-xs"
            />
          </div>
        )}

        <ul ref={listRef} aria-label={ariaLabel ?? placeholder} className="max-h-64 overflow-auto">
          {items.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-[var(--color-subtle-fg)]">
              {emptyText}
            </li>
          )}
          {items.map((option, idx) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || '__placeholder'}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => commit(option.value)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm transition-colors',
                    idx === activeIndex && 'bg-[var(--color-muted)]',
                    !option.value && 'text-[var(--color-muted-fg)]',
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected && <Check className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};
