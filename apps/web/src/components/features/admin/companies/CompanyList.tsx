import { listAdminCompanies } from '@/api/admin/companies';
import { listAdminPersons } from '@/api/admin/persons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BRANCH_LABELS, type CompanyDto } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EditCompanyDialog } from './EditCompanyDialog';

export const CompanyList = () => {
  const [editing, setEditing] = useState<CompanyDto | null>(null);

  const companiesQuery = useQuery({
    queryKey: ['admin', 'companies'],
    queryFn: () => listAdminCompanies(),
  });
  const personsQuery = useQuery({
    queryKey: ['admin', 'persons'],
    queryFn: () => listAdminPersons(),
  });

  const headNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of personsQuery.data ?? []) map.set(p.id, p.displayName);
    return map;
  }, [personsQuery.data]);

  return (
    <>
      <div className="rounded-md border border-[var(--color-border)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Сфера</TableHead>
              <TableHead>Руководитель</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companiesQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : (companiesQuery.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-[var(--color-muted-fg)]">
                  Компаний пока нет.
                </TableCell>
              </TableRow>
            ) : (
              (companiesQuery.data ?? []).map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{BRANCH_LABELS[company.branchCode]}</Badge>
                  </TableCell>
                  <TableCell>
                    {company.headPersonId ? (headNames.get(company.headPersonId) ?? '—') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(company)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditCompanyDialog
        company={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </>
  );
};
