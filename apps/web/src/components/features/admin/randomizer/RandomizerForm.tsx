import { listAdminPersons } from '@/api/admin/persons';
import { applyRandomizer, cancelRandomizer } from '@/api/admin/randomizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { PersonDto, RandomizerEntry } from '@kinoacademia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dices, RotateCcw, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDangerDialog } from '../ConfirmDangerDialog';

const randomInt = (range: number): number => {
  if (range <= 0) return 0;
  const r = Math.floor(Math.random() * (range * 2 + 1)) - range;
  return r;
};

export const RandomizerForm = () => {
  const qc = useQueryClient();
  const [range, setRange] = useState(50);
  const [preview, setPreview] = useState<RandomizerEntry[]>([]);

  const personsQuery = useQuery({
    queryKey: ['admin', 'persons', { isOpen: true }],
    queryFn: () => listAdminPersons({ isOpen: true }),
  });

  const persons: PersonDto[] = personsQuery.data ?? [];

  const generate = () => {
    if (range < 1) {
      toast.error('Диапазон должен быть положительным');
      return;
    }
    setPreview(persons.map((p) => ({ personId: p.id, value: randomInt(range) })));
  };

  const applyMutation = useMutation({
    mutationFn: applyRandomizer,
    onSuccess: () => {
      toast.success('Рандомайзер применён');
      qc.invalidateQueries({ queryKey: ['admin', 'all-ratings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setPreview([]);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelRandomizer,
    onSuccess: () => {
      toast.success('Значения рандомайзера обнулены');
      qc.invalidateQueries({ queryKey: ['admin', 'all-ratings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const idToName = new Map(persons.map((p) => [p.id, p.displayName]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Параметры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="range">Диапазон ±</Label>
              <Input
                id="range"
                type="number"
                min={1}
                max={1000}
                className="w-32"
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
              />
            </div>
            <Button onClick={generate} disabled={personsQuery.isLoading}>
              <Dices className="mr-2 h-4 w-4" />
              Сгенерировать
            </Button>
            <ConfirmDangerDialog
              trigger={
                <Button variant="destructive">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Обнулить рандомайзер
                </Button>
              }
              title="Обнулить значения рандомайзера?"
              description="Все активные значения рандомайзера будут сняты у всех персонажей. Действие необратимо."
              confirmLabel="Обнулить"
              isLoading={cancelMutation.isPending}
              onConfirm={() => cancelMutation.mutateAsync()}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Предпросмотр</CardTitle>
          {preview.length > 0 ? (
            <ConfirmDangerDialog
              trigger={
                <Button>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Применить
                </Button>
              }
              variant="default"
              title="Применить рандомайзер?"
              description={`Будут обновлены значения для ${preview.length} персонажей.`}
              confirmLabel="Применить"
              isLoading={applyMutation.isPending}
              onConfirm={() => applyMutation.mutateAsync({ values: preview })}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-[var(--color-border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Персонаж</TableHead>
                  <TableHead className="text-right">Значение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ) : preview.length > 0 ? (
                  preview.map((e) => (
                    <TableRow key={e.personId}>
                      <TableCell>{idToName.get(e.personId) ?? e.personId}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${e.value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-destructive)]'}`}
                      >
                        {e.value > 0 ? `+${e.value}` : e.value}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-[var(--color-muted-fg)]">
                      Нажмите «Сгенерировать», чтобы получить предпросмотр.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
