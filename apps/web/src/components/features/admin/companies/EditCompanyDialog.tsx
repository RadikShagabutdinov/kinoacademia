import { updateAdminCompany } from '@/api/admin/companies';
import { listAdminPersons } from '@/api/admin/persons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { BRANCHES, BRANCH_LABELS, type BranchCode, type CompanyDto } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Props = {
  company: CompanyDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const EditCompanyDialog = ({ company, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState<BranchCode>('cinema');
  const [headPersonId, setHeadPersonId] = useState<string>('');

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { isOpen: true }],
    queryFn: () => listAdminPersons({ isOpen: true }),
    enabled: open,
  });

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setBranchCode(company.branchCode);
    setHeadPersonId(company.headPersonId ?? '');
  }, [company]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; branchCode: BranchCode; headPersonId: string | null }) =>
      updateAdminCompany(company?.id ?? '', {
        name: input.name,
        branchCode: input.branchCode,
        headPersonId: input.headPersonId,
      }),
    onSuccess: () => {
      toast.success('Компания обновлена');
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Не удалось обновить компанию')),
  });

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактирование компании</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              name: name.trim(),
              branchCode,
              headPersonId: headPersonId || null,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="edit-company-name">Название</Label>
            <Input
              id="edit-company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Сфера</Label>
            <Select value={branchCode} onValueChange={(v) => setBranchCode(v as BranchCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRANCHES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {BRANCH_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Руководитель</Label>
            <Select
              value={headPersonId || 'none'}
              onValueChange={(v) => setHeadPersonId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {(personsQuery.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
