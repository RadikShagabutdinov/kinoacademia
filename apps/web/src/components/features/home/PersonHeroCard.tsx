import { Badge } from '@/components/ui/badge';
import { DisplayNumber, SectionLabel } from '@/components/ui/typography';
import { formatAmount } from '@/lib/tone';
import type { PersonDto, PersonRatingDto } from '@kinoacademia/shared';

type Props = {
  person: PersonDto;
  rating: PersonRatingDto;
};

/**
 * Карточка персонажа в шапке главной: аватар, бейдж Звезды, постоянный рейтинг
 * крупной цифрой и остаток переменного рядом.
 */
export const PersonHeroCard = ({ person, rating }: Props) => (
  <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-elevated)] to-[var(--color-card)] p-5">
    <div className="flex items-center gap-3.5">
      <div
        className="font-[family-name:var(--font-display)] flex h-15 w-15 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--color-bg)] text-[22px] font-black"
        style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
        aria-hidden
      >
        {person.displayName.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold leading-tight">{person.displayName}</div>
        {rating.isStar && (
          <div className="mt-1.5">
            <Badge variant="star">★ Звезда</Badge>
          </div>
        )}
      </div>
    </div>

    <div className="mt-5 flex items-end justify-between gap-4">
      <div>
        <SectionLabel>Постоянный рейтинг</SectionLabel>
        <DisplayNumber size="lg" className="mt-1.5 text-[var(--color-accent)]">
          {formatAmount(rating.nowPermanent)}
        </DisplayNumber>
      </div>
      <div className="text-right">
        <SectionLabel>Восхищение</SectionLabel>
        <DisplayNumber className="mt-1.5">{formatAmount(rating.generated)}</DisplayNumber>
        <div className="mt-1 text-[10px] font-semibold text-[var(--color-subtle-fg)]">
          доступно раздать
        </div>
      </div>
    </div>
  </section>
);
