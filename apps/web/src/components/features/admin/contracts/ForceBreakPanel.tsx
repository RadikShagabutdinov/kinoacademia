import { listAdminCompanies } from '@/api/admin/companies';
import { forceBreakContract, listActiveAdminContracts } from '@/api/admin/contracts';
import { listAdminPersons } from '@/api/admin/persons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  CONTRACT_STATUS_LABELS,
  type ContractDto,
  type ForceBreakSide,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';

type PendingBreak = {
  contract: ContractDto;
  side: ForceBreakSide;
};

export const ForceBreakPanel = () => {
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingBreak | null>(null);
  const [sideById, setSideById] = useState<Record<string, ForceBreakSide>>({});

  const contractsQuery = useQuery({
    queryKey: ['admin', 'contracts', 'active'],
    queryFn: listActiveAdminContracts,
  });
  const personsQuery = useQuery({
    queryKey: ['admin', 'persons'],
    queryFn: () => listAdminPersons(),
  });
  const companiesQuery = useQuery({
    queryKey: ['admin', 'companies'],
    queryFn: () => listAdminCompanies(),
  });

  const personNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of personsQuery.data ?? []) map.set(p.id, p.displayName);
    return map;
  }, [personsQuery.data]);

  const companyNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companiesQuery.data ?? []) map.set(c.id, c.name);
    return map;
  }, [companiesQuery.data]);

  const mutation = useMutation({
    mutationFn: ({ contract, side }: PendingBreak) =>
      forceBreakContract(contract.kind, contract.id, {
        side,
        applyPenalty: contract.kind === 'permanent' && side === 'person',
        comment: 'Admin force break',
      }),
    onSuccess: () => {
      toast.success('Контракт принудительно разорван');
      qc.invalidateQueries({ queryKey: ['admin', 'contracts', 'active'] });
      qc.invalidateQueries({ queryKey: ['admin', 'contracts-history'] });
      setPending(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Не удалось разорвать контракт')),
  });

  const rows = contractsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          Принудительные разрывы
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-[var(--color-border)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Персонаж</TableHead>
                <TableHead>Компания</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Сторона разрыва</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-[var(--color-muted-fg)]">
                    Нет активных контрактов для принудительного разрыва.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((contract) => {
                  const side = sideById[contract.id] ?? 'company';
                  return (
                    <TableRow key={`${contract.kind}-${contract.id}`}>
                      <TableCell>
                        {personNames.get(contract.personId) ?? contract.personId}
                      </TableCell>
                      <TableCell>
                        {companyNames.get(contract.companyId) ?? contract.companyId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {contract.kind === 'permanent' ? 'Постоянный' : 'Временный'}
                        </Badge>
                      </TableCell>
                      <TableCell>{CONTRACT_STATUS_LABELS[contract.statusCode]}</TableCell>
                      <TableCell>
                        <Select
                          value={side}
                          onValueChange={(v) =>
                            setSideById((prev) => ({ ...prev, [contract.id]: v as ForceBreakSide }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="company">Компания</SelectItem>
                            <SelectItem value="person">Персонаж</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPending({ contract, side })}
                        >
                          Разорвать
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Принудительный разрыв контракта</AlertDialogTitle>
              <AlertDialogDescription>
                Контракт будет завершён без прохождения статусной цепочки. Для постоянного контракта
                со стороны персонажа может быть начислен штраф.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={mutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (pending) mutation.mutate(pending);
                }}
              >
                {mutation.isPending ? 'Подождите…' : 'Разорвать'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
