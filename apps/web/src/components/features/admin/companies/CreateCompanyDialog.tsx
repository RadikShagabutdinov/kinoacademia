import { createAdminCompany } from '@/api/admin/companies';
import { listAdminPersons } from '@/api/admin/persons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { BRANCHES, BRANCH_LABELS, type BranchCode } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export const CreateCompanyDialog = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [branchCode, setBranchCode] = useState<BranchCode>('cinema');
  const [headPersonId, setHeadPersonId] = useState<string>('');
  const qc = useQueryClient();

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { isOpen: true }],
    queryFn: () => listAdminPersons({ isOpen: true }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: createAdminCompany,
    onSuccess: () => {
      toast.success('Компания создана');
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      setOpen(false);
      setName('');
      setHeadPersonId('');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Не удалось создать компанию')),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Создать
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая компания</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              name: name.trim(),
              branchCode,
              ...(headPersonId && { headPersonId }),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Название</Label>
            <Input
              id="company-name"
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
            <Label>Руководитель (опционально)</Label>
            <Select
              value={headPersonId || 'none'}
              onValueChange={(v) => setHeadPersonId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Не назначен" />
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
              {mutation.isPending ? 'Создание…' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
