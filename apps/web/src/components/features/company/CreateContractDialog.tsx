import { createCompanyContract } from '@/api/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { NoticeBox } from '@/components/ui/notice-box';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ContractKind } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

type Props = {
  companyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export const CreateContractDialog = ({ companyId, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { data: persons = [] } = useOpenPersons();
  const [personId, setPersonId] = useState('');
  const [kind, setKind] = useState<ContractKind>('temporary');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPersonId('');
    setKind('temporary');
    setError(null);
  };

  const mutation = useMutation({
    mutationFn: () => createCompanyContract(companyId, { kind, personId, companyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts', 'company', companyId] });
      reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, 'Не удалось создать контракт');
      setError(msg);
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!personId) {
      setError('Выберите персонажа');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый контракт</DialogTitle>
          <DialogDescription>
            Создайте черновик и отправьте его персонажу для подтверждения.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="contract-person">Персонаж</Label>
            <NativeSelect
              id="contract-person"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">— Выберите —</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contract-kind">Тип контракта</Label>
            <NativeSelect
              id="contract-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContractKind)}
            >
              <option value="temporary">Временный</option>
              <option value="permanent">Постоянный</option>
            </NativeSelect>
          </div>

          {error && <NoticeBox tone="danger">{error}</NoticeBox>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Создаём…' : 'Создать черновик'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
