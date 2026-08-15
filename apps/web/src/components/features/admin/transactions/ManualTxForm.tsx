import { listAdminCompanies } from '@/api/admin/companies';
import { listAdminPersons } from '@/api/admin/persons';
import { getAdminAllRatings } from '@/api/admin/ratings';
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
import type { ManualRatingKind, ManualRatingMode, RatingSlot } from '@kinoacademia/shared';
import {
  COMPANY_RATING_SLOTS,
  PERSON_RATING_SLOTS,
  computePercentAmount,
} from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { useState } from 'react';

type SideType = 'person' | 'company';
/** У источника есть дополнительный вариант: неисчерпаемый админский ресурс. */
type SourceType = SideType | 'admin';

const KIND_LABELS: Record<ManualRatingKind, string> = {
  manual: 'Ручное (manual)',
  oscar: 'Оскар',
  penalty: 'Штраф',
  base: 'База (стартовый рейтинг)',
};

/** Составляющая постоянного рейтинга зависит от того, кому начисляем. */
const KINDS_BY_SIDE: Record<SideType, ManualRatingKind[]> = {
  person: ['manual', 'oscar', 'penalty', 'base'],
  company: ['manual', 'oscar', 'penalty'],
};

const SLOTS_BY_SIDE: Record<SideType, readonly RatingSlot[]> = {
  person: PERSON_RATING_SLOTS,
  company: COMPANY_RATING_SLOTS,
};

const SLOT_LABELS: Record<RatingSlot, string> = {
  permanent: 'Постоянный рейтинг',
  variable: 'Переменный рейтинг',
  budget: 'Бюджет',
};

const MODE_LABELS: Record<ManualRatingMode, string> = {
  absolute: 'Абсолютное значение',
  percent: 'Процент от постоянного рейтинга компании',
};

export const ManualTxForm = () => {
  const qc = useQueryClient();
  const [sourceType, setSourceType] = useState<SourceType>('admin');
  const [sourceId, setSourceId] = useState<string>('');
  const [sourceSlot, setSourceSlot] = useState<RatingSlot>('permanent');
  const [targetType, setTargetType] = useState<SideType>('person');
  const [targetId, setTargetId] = useState<string>('');
  const [targetSlot, setTargetSlot] = useState<RatingSlot>('permanent');
  const [kind, setKind] = useState<ManualRatingKind>('manual');
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<ManualRatingMode>('absolute');
  const [comment, setComment] = useState<string>('');

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { isOpen: true }],
    queryFn: () => listAdminPersons({ isOpen: true }),
    enabled: targetType === 'person' || sourceType === 'person',
  });
  const companiesQuery = useQuery({
    queryKey: ['admin', 'companies', 'all'],
    queryFn: () => listAdminCompanies(),
    enabled: targetType === 'company' || sourceType === 'company',
  });
  const ratingsQuery = useQuery({
    queryKey: ['admin', 'all-ratings'],
    queryFn: getAdminAllRatings,
    enabled: sourceType !== 'admin',
  });

  const optionsFor = (type: SideType) =>
    type === 'person'
      ? (personsQuery.data ?? []).map((p) => ({ id: p.id, label: p.displayName }))
      : (companiesQuery.data ?? []).map((c) => ({ id: c.id, label: c.name }));

  const sourceBalance = ((): number | null => {
    if (sourceType === 'admin' || !sourceId || !ratingsQuery.data) return null;
    if (sourceType === 'person') {
      const row = ratingsQuery.data.persons.find((p) => p.personId === sourceId);
      if (!row) return null;
      return sourceSlot === 'variable' ? row.generated : row.nowPermanent;
    }
    const row = ratingsQuery.data.companies.find((c) => c.companyId === sourceId);
    if (!row) return null;
    return sourceSlot === 'budget' ? row.budget : row.nowPermanent;
  })();

  // Процентом платит только компания со своего постоянного счёта.
  const percentAllowed = sourceType === 'company' && sourceSlot === 'permanent';
  // База задаёт отправную точку постоянного рейтинга — её вносят числом.
  const absoluteOnly = !percentAllowed || (targetSlot === 'permanent' && kind === 'base');

  /** Сумма перевода в абсолютной величине: в режиме процента — доля от рейтинга источника. */
  const resolvedAmount =
    mode === 'percent'
      ? sourceBalance === null
        ? null
        : computePercentAmount(Number(amount), sourceBalance)
      : Number(amount);

  const overdraft =
    sourceBalance !== null && resolvedAmount !== null && resolvedAmount > sourceBalance;

  const selectSourceType = (next: SourceType) => {
    setSourceType(next);
    setSourceId('');
    setSourceSlot('permanent');
    // Переменный рейтинг персонажа пополняется только из админского ресурса.
    if (next !== 'admin' && targetSlot === 'variable') setTargetSlot('permanent');
    if (next !== 'company') setMode('absolute');
  };

  const selectTargetType = (next: SideType) => {
    setTargetType(next);
    setTargetId('');
    setTargetSlot('permanent');
    // База есть только у персонажа — при смене типа выбор сбрасываем.
    setKind('manual');
  };

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
    if (sourceType !== 'admin' && !sourceId) {
      toast.error('Выберите источник');
      return;
    }
    if (sourceType !== 'admin' && value < 0) {
      toast.error('При переводе от персонажа или компании значение должно быть положительным');
      return;
    }
    if (overdraft) {
      toast.error('У источника недостаточно рейтинга — отрицательный рейтинг невозможен');
      return;
    }

    mutation.mutate({
      to: {
        ...(targetType === 'person' ? { personId: targetId } : { companyId: targetId }),
        slot: targetSlot,
        kind: targetSlot === 'permanent' ? kind : 'manual',
      },
      ...(sourceType !== 'admin' && {
        from: {
          ...(sourceType === 'person' ? { personId: sourceId } : { companyId: sourceId }),
          slot: sourceSlot,
        },
      }),
      amount: value,
      mode,
      ...(comment.trim() && { comment: comment.trim() }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ручная транзакция рейтинга</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase text-[var(--color-subtle-fg)]">
              Откуда
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="source-type">Источник</Label>
                <Select value={sourceType} onValueChange={(v) => selectSourceType(v as SourceType)}>
                  <SelectTrigger id="source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Админский ресурс</SelectItem>
                    <SelectItem value="person">Персонаж</SelectItem>
                    <SelectItem value="company">Компания</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sourceType !== 'admin' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="source-entity">
                      {sourceType === 'person' ? 'Персонаж' : 'Компания'}
                    </Label>
                    <Select value={sourceId} onValueChange={setSourceId}>
                      <SelectTrigger id="source-entity">
                        <SelectValue placeholder="Выбрать…" />
                      </SelectTrigger>
                      <SelectContent>
                        {optionsFor(sourceType).map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="source-slot">Часть рейтинга</Label>
                    <Select
                      value={sourceSlot}
                      onValueChange={(v) => {
                        const next = v as RatingSlot;
                        setSourceSlot(next);
                        // Процент считается только от постоянного счёта компании.
                        if (next !== 'permanent') setMode('absolute');
                      }}
                    >
                      <SelectTrigger id="source-slot">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SLOTS_BY_SIDE[sourceType].map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {SLOT_LABELS[slot]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {sourceBalance !== null && (
              <p
                className={
                  overdraft
                    ? 'text-xs font-bold text-[var(--color-destructive)]'
                    : 'text-xs text-[var(--color-subtle-fg)]'
                }
              >
                Доступно у источника: {sourceBalance}
                {overdraft && ' — этого не хватит, отрицательный рейтинг невозможен'}
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold uppercase text-[var(--color-subtle-fg)]">
              Кому
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="target-type">Тип получателя</Label>
                <Select value={targetType} onValueChange={(v) => selectTargetType(v as SideType)}>
                  <SelectTrigger id="target-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Персонаж</SelectItem>
                    <SelectItem value="company">Компания</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target-entity">Получатель</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger id="target-entity">
                    <SelectValue placeholder="Выбрать…" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsFor(targetType).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="target-slot">Часть рейтинга</Label>
                <Select value={targetSlot} onValueChange={(v) => setTargetSlot(v as RatingSlot)}>
                  <SelectTrigger id="target-slot">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOTS_BY_SIDE[targetType].map((slot) => (
                      <SelectItem
                        key={slot}
                        value={slot}
                        disabled={slot === 'variable' && sourceType !== 'admin'}
                      >
                        {SLOT_LABELS[slot]}
                        {slot === 'variable' && sourceType !== 'admin'
                          ? ' — только из админского ресурса'
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {targetSlot === 'permanent' && (
                <div className="space-y-1.5">
                  <Label htmlFor="target-kind">Составляющая</Label>
                  <Select
                    value={kind}
                    onValueChange={(v) => {
                      const next = v as ManualRatingKind;
                      setKind(next);
                      // База вносится только абсолютной величиной.
                      if (next === 'base') setMode('absolute');
                    }}
                  >
                    <SelectTrigger id="target-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS_BY_SIDE[targetType].map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <Label htmlFor="mode">Режим</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as ManualRatingMode)}>
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absolute">{MODE_LABELS.absolute}</SelectItem>
                    <SelectItem value="percent" disabled={absoluteOnly}>
                      {MODE_LABELS.percent}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === 'percent' && resolvedAmount !== null && sourceBalance !== null && (
              <p className="text-xs text-[var(--color-subtle-fg)]">
                {amount || 0}% от постоянного рейтинга компании ({sourceBalance}) — это{' '}
                <span className="font-bold text-[var(--color-fg)]">{resolvedAmount}</span>
              </p>
            )}
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
