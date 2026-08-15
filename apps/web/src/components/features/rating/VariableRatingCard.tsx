import { Button } from '@/components/ui/button';
import { DisplayNumber, MonoValue, SectionLabel } from '@/components/ui/typography';
import { formatAmount } from '@/lib/tone';
import type { PersonRatingDto } from '@kinoacademia/shared';
import { Link } from '@tanstack/react-router';
import { Scale, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

type Props = {
  rating: PersonRatingDto;
};

const SLOT_MS = 60_000;

const formatMS = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

/** Мс до конца текущей минуты — слота начисления переменного рейтинга. */
const useSlotCountdown = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return SLOT_MS - (now % SLOT_MS);
};

export const VariableRatingCard = ({ rating }: Props) => {
  const left = useSlotCountdown();
  // Полосу привязываем к прогрессу слота: точного времени обнуления клиент
  // не знает — расписание живёт в БД и доступно только администратору.
  const progress = ((SLOT_MS - left) / SLOT_MS) * 100;

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Переменный · восхищение</SectionLabel>
        <MonoValue className="text-[10.5px] text-[var(--color-star)]">
          обновление через {formatMS(left)}
        </MonoValue>
      </div>

      <div className="mt-2.5 flex items-end gap-3">
        <DisplayNumber size="lg" className="text-[var(--color-star)]">
          {formatAmount(rating.generated)}
        </DisplayNumber>
        <span className="pb-2 text-[11.5px] leading-snug text-[var(--color-muted-fg)]">
          единиц можно
          <br />
          раздать
        </span>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-[var(--color-star)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button asChild size="xl">
          <Link to="/admire">
            <Sparkles className="h-4 w-4" />
            Выразить восхищение
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline">
          <Link to="/compare">
            <Scale className="h-4 w-4" />
            Встречная проверка
          </Link>
        </Button>
      </div>
    </section>
  );
};
