import { BRANCH_LABELS, type BranchCode, type CompanyRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { DISPLAY_SCALE } from './scale';

type CompaniesBoardProps = {
  ratings: CompanyRatingDto[];
  meta: Record<string, { name: string; branchCode: BranchCode }>;
  limit: 'top10' | 'all';
};

const numFmt = (v: number): string => v.toLocaleString('ru-RU');

/** Публичный рейтинг компании — сумма постоянных составляющих, как на её экране. */
const permanentOf = (r: CompanyRatingDto): number =>
  r.employeePermanent + r.manualTopup + r.oscar + r.penalties;

export const CompaniesBoard = ({ ratings, meta, limit }: CompaniesBoardProps) => {
  const sorted = useMemo(
    () => [...ratings].sort((a, b) => permanentOf(b) - permanentOf(a)),
    [ratings],
  );
  const rows = limit === 'top10' ? sorted.slice(0, 10) : sorted;

  return (
    <BoardShell
      title="Компании"
      subtitle={
        limit === 'top10' ? `Топ-${rows.length} из ${sorted.length}` : `Все ${sorted.length}`
      }
      columns={['Компания', 'Сфера', 'Рейтинг']}
    >
      {rows.map((row, idx) => {
        const m = meta[row.companyId];
        return (
          <LeaderboardRow
            key={row.companyId}
            rank={idx + 1}
            trackedValue={permanentOf(row)}
            cells={[
              { key: 'name', content: m?.name ?? '—', className: 'font-bold' },
              {
                key: 'branch',
                content: m ? BRANCH_LABELS[m.branchCode] : '—',
                className: 'text-[var(--color-muted-fg)]',
                fontSize: DISPLAY_SCALE.columnLabel,
              },
              {
                key: 'permanent',
                content: numFmt(permanentOf(row)),
                className:
                  'font-[family-name:var(--font-display)] text-right font-black tabular-nums text-[var(--color-accent)]',
                fontSize: DISPLAY_SCALE.value,
              },
            ]}
          />
        );
      })}
    </BoardShell>
  );
};
