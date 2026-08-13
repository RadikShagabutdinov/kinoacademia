import { formatAmount } from '@/lib/tone';
import { BRANCH_LABELS, type BranchCode, type CompanyRatingDto } from '@kinoacademia/shared';
import { useMemo } from 'react';
import { type BoardColumn, BoardShell } from './BoardShell';
import { LeaderboardRow } from './LeaderboardRow';
import { COLUMN_WIDTHS, DISPLAY_SCALE, NARROW_COLUMN_WIDTHS } from './scale';

type CompaniesBoardProps = {
  ratings: CompanyRatingDto[];
  meta: Record<string, { name: string; branchCode: BranchCode }>;
  limit: 'top10' | 'all';
  /** Мобильный вид: список прокручивается, столбцы уже. */
  narrow: boolean;
};

/** На витрине показываем только игровые компании: инфраструктура отеля вне зачёта. */
const VISIBLE_BRANCHES: readonly BranchCode[] = ['farm', 'cinema'];

export const CompaniesBoard = ({ ratings, meta, limit, narrow }: CompaniesBoardProps) => {
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

  const widths = narrow ? NARROW_COLUMN_WIDTHS : COLUMN_WIDTHS;
  const columns: readonly BoardColumn[] = [
    { label: 'Компания', width: widths.name },
    { label: 'Сфера', width: widths.branch },
    { label: 'Рейтинг', width: widths.value, alignRight: true },
  ];

  return (
    <BoardShell
      title="Компании"
      subtitle={
        limit === 'top10' ? `Топ-${rows.length} из ${sorted.length}` : `Все ${sorted.length}`
      }
      columns={columns}
      rankWidth={widths.rank}
      narrow={narrow}
    >
      {rows.map((row, idx) => {
        const m = meta[row.companyId];
        return (
          <LeaderboardRow
            key={row.companyId}
            rank={idx + 1}
            trackedValue={row.nowPermanent}
            rankWidth={widths.rank}
            narrow={narrow}
            cells={[
              {
                key: 'name',
                width: widths.name,
                content: m?.name ?? '—',
                className: 'font-bold',
              },
              {
                key: 'branch',
                width: widths.branch,
                content: m ? BRANCH_LABELS[m.branchCode] : '—',
                className: 'text-[var(--color-muted-fg)]',
                fontSize: DISPLAY_SCALE.columnLabel,
              },
              {
                key: 'permanent',
                width: widths.value,
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
