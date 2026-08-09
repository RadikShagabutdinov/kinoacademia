import { listAdminCompanies } from '@/api/admin/companies';
import { listAdminPersons } from '@/api/admin/persons';
import { createManualTransaction } from '@/api/admin/transactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ManualRatingKind, ManualRatingMode } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { useState } from 'react';

type TargetType = 'person' | 'company';

const KIND_LABELS: Record<ManualRatingKind, string> = {
  manual: 'Ручное (manual)',
  oscar: 'Оскар',
  penalty: 'Штраф',
  base: 'База (стартовый рейтинг)',
  budget: 'Бюджет компании',
};

/** Вид начисления зависит от того, кому начисляем. */
const KINDS_BY_TARGET: Record<TargetType, ManualRatingKind[]> = {
  person: ['manual', 'oscar', 'penalty', 'base'],
  company: ['manual', 'oscar', 'penalty', 'budget'],
};

const MODE_LABELS: Record<ManualRatingMode, string> = {
  absolute: 'Абсолютное значение',
  percent: 'Процент от постоянного',
};

export const ManualTxForm = () => {
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<TargetType>('person');
  const [targetId, setTargetId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<ManualRatingMode>('absolute');
  const [kind, setKind] = useState<ManualRatingKind>('manual');
  const [comment, setComment] = useState<string>('');

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { isOpen: true }],
    queryFn: () => listAdminPersons({ isOpen: true }),
    enabled: targetType === 'person',
  });
  const companiesQuery = useQuery({
    queryKey: ['admin', 'companies', 'all'],
    queryFn: () => listAdminCompanies(),
    enabled: targetType === 'company',
  });

  const mutation = useMutation({
    mutationFn: createManualTransaction,
    onSuccess: () => {
      toast.success('Транзакция создана');
      qc.invalidateQueries({ queryKey: ['admin', 'all-ratings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setAmount('');
      setComment('');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value === 0) {
      toast.error('Укажите целое ненулевое значение');
      return;
    }
    if (!targetId) {
      toast.error('Выберите получателя');
      return;
    }
    mutation.mutate({
      ...(targetType === 'person' ? { targetPersonId: targetId } : { targetCompanyId: targetId }),
      amount: value,
      mode,
      kind,
      ...(comment.trim() && { comment: comment.trim() }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ручная транзакция рейтинга</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Тип получателя</Label>
              <Select
                value={targetType}
                onValueChange={(v) => {
                  setTargetType(v as TargetType);
                  setTargetId('');
                  // base и budget привязаны к типу получателя — сбрасываем выбор.
                  setKind('manual');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Персонаж</SelectItem>
                  <SelectItem value="company">Компания</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Получатель</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выбрать…" />
                </SelectTrigger>
                <SelectContent>
                  {targetType === 'person'
                    ? (personsQuery.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.displayName}
                        </SelectItem>
                      ))
                    : (companiesQuery.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Значение</Label>
              <Input
                id="amount"
                type="number"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Режим</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ManualRatingMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">{MODE_LABELS.absolute}</SelectItem>
                  <SelectItem value="percent" disabled={kind === 'base' || kind === 'budget'}>
                    {MODE_LABELS.percent}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Тип начисления</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  const next = v as ManualRatingKind;
                  setKind(next);
                  // База и бюджет вносятся только абсолютной величиной.
                  if (next === 'base' || next === 'budget') setMode('absolute');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS_BY_TARGET[targetType].map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comment">Комментарий</Label>
            <Textarea
              id="comment"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например, «За предъявление драгоценностей Звезды»"
            />
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            <Coins className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Создание…' : 'Создать транзакцию'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
