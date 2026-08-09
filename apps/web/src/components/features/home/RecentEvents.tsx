import { MonoValue, SectionLabel } from '@/components/ui/typography';
import { signedTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import type { RatingTransactionDto, RatingTxKind } from '@kinoacademia/shared';

type Props = {
  transactions: RatingTransactionDto[];
  meId: string;
};

// Секретные мастерские виды транзакций (randomizer) до игровых экранов не
// доходят — сервер их не отдаёт, поэтому подписи для них здесь нет.
const KIND_LABELS: Partial<Record<RatingTxKind, string>> = {
  variable_to_permanent: 'Перевод в постоянный',
  manual: 'Ручное начисление',
  oscar: 'Оскар',
  penalty: 'Штраф',
  star_bonus: 'Бонус Звезды',
  generated: 'Начислено переменного',
  base: 'Базовый рейтинг',
  budget: 'Бюджет',
};

const kindLabel = (kind: RatingTxKind): string => KIND_LABELS[kind] ?? 'Начисление';

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const RecentEvents = ({ transactions, meId }: Props) => {
  if (transactions.length === 0) return null;

  return (
    <section>
      <SectionLabel className="mb-2.5">Последние события</SectionLabel>
      <ul className="flex flex-col gap-2">
        {transactions.map((tx) => {
          // Знак считаем от лица текущего персонажа: получил — плюс, отдал — минус.
          const incoming = tx.recipientPersonId === meId;
          const signed = incoming ? tx.amount : -tx.amount;
          return (
            <li
              key={tx.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-3"
            >
              <MonoValue className={cn('shrink-0 text-[13px]', signedTone(signed))}>
                {incoming ? '+' : '−'}
                {Math.abs(tx.amount)}
              </MonoValue>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {tx.comment || kindLabel(tx.kind)}
              </span>
              <MonoValue className="shrink-0 text-[11px] font-semibold text-[var(--color-subtle-fg)]">
                {formatTime(tx.createdAt)}
              </MonoValue>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
