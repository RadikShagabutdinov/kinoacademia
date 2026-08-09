import { MonoValue, SectionLabel } from '@/components/ui/typography';
import { signedTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { RatingTransactionDto, RatingTxKind } from '@kinoacademia/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

type Props = {
  transactions: RatingTransactionDto[];
  meId: string;
};

// Секретные мастерские виды транзакций (randomizer) до игровых экранов не
// доходят — сервер их не отдаёт, поэтому подписи для них здесь нет.
const KIND_LABELS: Partial<Record<RatingTxKind, string>> = {
  variable_to_permanent: 'восхищение',
  manual: 'ручное начисление',
  oscar: 'оскар',
  penalty: 'штраф',
  star_bonus: 'бонус Звезды',
  generated: 'начислено переменного',
  base: 'базовый рейтинг',
  budget: 'бюджет',
};

const kindLabel = (kind: RatingTxKind): string => KIND_LABELS[kind] ?? 'начисление';

const ROW_HEIGHT = 58;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const directionFor = (tx: RatingTransactionDto, meId: string): 'in' | 'out' | 'neutral' => {
  if (tx.recipientPersonId === meId) return 'in';
  if (tx.donorPersonId === meId) return 'out';
  return 'neutral';
};

export const RatingHistoryList = ({ transactions, meId }: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <SectionLabel>История</SectionLabel>
        <span className="text-[11px] font-bold text-[var(--color-subtle-fg)]">
          {transactions.length} транзакций
        </span>
      </div>

      {transactions.length === 0 ? (
        <p className="text-xs text-[var(--color-subtle-fg)]">Транзакций пока нет.</p>
      ) : (
        <div
          ref={parentRef}
          className="max-h-96 overflow-auto rounded-[var(--radius-xl)] border border-[var(--color-border)]"
        >
          <ul className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const tx = transactions[vi.index];
              if (!tx) return null;
              const dir = directionFor(tx, meId);
              const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
              return (
                <li
                  key={tx.id}
                  className="absolute left-0 right-0 flex items-center gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-3.5 last:border-0"
                  style={{ transform: `translateY(${vi.start}px)`, height: `${vi.size}px` }}
                >
                  <MonoValue
                    className={cn(
                      'w-12 shrink-0 text-[13px]',
                      signedTone(dir === 'in' ? 1 : dir === 'out' ? -1 : 0),
                    )}
                  >
                    {sign}
                    {Math.abs(tx.amount)}
                  </MonoValue>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold">
                      {tx.comment || kindLabel(tx.kind)}
                    </div>
                    <div className="truncate text-[10.5px] text-[var(--color-subtle-fg)]">
                      {kindLabel(tx.kind)}
                    </div>
                  </div>
                  <MonoValue className="shrink-0 text-[10.5px] font-semibold text-[var(--color-subtle-fg)]">
                    {formatTime(tx.createdAt)}
                  </MonoValue>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
