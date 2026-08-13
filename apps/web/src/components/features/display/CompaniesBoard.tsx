import { formatAmount } from '@/lib/tone';
import { BRANCH_LABELS, type BranchCode, type CompanyRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { type BoardColumn, BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { COLUMN_WIDTH, DISPLAY_SCALE } from './scale';

type CompaniesBoardProps = {
  ratings: CompanyRatingDto[];
  meta: Record<string, { name: string; branchCode: BranchCode }>;
  limit: 'top10' | 'all';
};

const COLUMNS: readonly BoardColumn[] = [
  { label: 'Компания', width: COLUMN_WIDTH.name },
  { label: 'Сфера', width: COLUMN_WIDTH.branch },
  { label: 'Рейтинг', width: COLUMN_WIDTH.value, alignRight: true },
];

/** На витрине показываем только игровые компании: инфраструктура отеля вне зачёта. */
const VISIBLE_BRANCHES: readonly BranchCode[] = ['farm', 'cinema'];

export const CompaniesBoard = ({ ratings, meta, limit }: CompaniesBoardProps) => {
  const sorted = useMemo(
    () =>
      ratings
        .filter((r) => {
          const branch = meta[r.companyId]?.branchCode;
          return branch !== undefined && VISIBLE_BRANCHES.includes(branch);
        })
        .sort((a, b) => b.nowPermanent - a.nowPermanent),
    [ratings, meta],
  );
  const rows = limit === 'top10' ? sorted.slice(0, 10) : sorted;

  return (
    <BoardShell
      title="Компании"
      subtitle={
        limit === 'top10' ? `Топ-${rows.length} из ${sorted.length}` : `Все ${sorted.length}`
      }
      columns={COLUMNS}
    >
      {rows.map((row, idx) => {
        const m = meta[row.companyId];
        return (
          <LeaderboardRow
            key={row.companyId}
            rank={idx + 1}
            trackedValue={row.nowPermanent}
            cells={[
              {
                key: 'name',
                width: COLUMN_WIDTH.name,
                content: m?.name ?? '—',
                className: 'font-bold',
              },
              {
                key: 'branch',
                width: COLUMN_WIDTH.branch,
                content: m ? BRANCH_LABELS[m.branchCode] : '—',
                className: 'text-[var(--color-muted-fg)]',
                fontSize: DISPLAY_SCALE.columnLabel,
              },
              {
                key: 'permanent',
                width: COLUMN_WIDTH.value,
                content: formatAmount(row.nowPermanent),
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
