import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NOMINATION_LABELS, type OscarNominationDetailDto } from '@kinoacademia/shared';
import type { ReactNode } from 'react';

type Props = {
  rows: OscarNominationDetailDto[];
  /** Дополнительная колонка действий (например, «Присудить» в админке). */
  actionsHeader?: string;
  renderActions?: (row: OscarNominationDetailDto) => ReactNode;
  emptyMessage?: string;
};

export const NominationsTable = ({
  rows,
  actionsHeader,
  renderActions,
  emptyMessage = 'Номинаций пока нет.',
}: Props) => {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{emptyMessage}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Категория</TableHead>
          <TableHead>Фильм</TableHead>
          <TableHead>Персонаж</TableHead>
          <TableHead>Компания</TableHead>
          <TableHead>Статус</TableHead>
          {renderActions && <TableHead>{actionsHeader ?? ''}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{NOMINATION_LABELS[r.nominationCode]}</TableCell>
            <TableCell>{r.filmTitle ?? '—'}</TableCell>
            <TableCell>{r.personName ?? '—'}</TableCell>
            <TableCell>{r.companyName ?? '—'}</TableCell>
            <TableCell>
              {r.isWinner ? (
                <Badge variant="star">Победитель</Badge>
              ) : (
                <Badge variant="secondary">Подана</Badge>
              )}
            </TableCell>
            {renderActions && <TableCell>{renderActions(r)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
