import { updateJob } from '@/api/admin/jobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/apiError';
import type { JobDefinitionWithLastRunDto, UpdateJobInput } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Props = {
  job: JobDefinitionWithLastRunDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const JobEditDialog = ({ job, open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [cronExpr, setCronExpr] = useState('');
  const [timezone, setTimezone] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [paramsText, setParamsText] = useState('{}');
  const [paramsError, setParamsError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setCronExpr(job.cronExpr);
      setTimezone(job.timezone);
      setEnabled(job.enabled);
      setParamsText(JSON.stringify(job.params ?? {}, null, 2));
      setParamsError(null);
    }
  }, [job]);

  const mutation = useMutation({
    mutationFn: (input: UpdateJobInput) => {
      // Диалог рендерится только с выбранной задачей, но типу об этом неизвестно.
      if (!job) throw new Error('Задача не выбрана');
      return updateJob(job.key, input);
    },
    onSuccess: () => {
      toast.success('Задача обновлена');
      qc.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  if (!job) return null;

  const submit = () => {
    let parsedParams: Record<string, unknown> | undefined;
    if (paramsText.trim()) {
      try {
        const parsed = JSON.parse(paramsText);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Должен быть объект');
        }
        parsedParams = parsed as Record<string, unknown>;
      } catch (err) {
        setParamsError(getApiErrorMessage(err, 'Неверный JSON'));
        return;
      }
    }
    setParamsError(null);

    const input: UpdateJobInput = {
      ...(cronExpr !== job.cronExpr && { cronExpr }),
      ...(timezone !== job.timezone && { timezone }),
      ...(enabled !== job.enabled && { enabled }),
      ...(parsedParams !== undefined &&
        JSON.stringify(parsedParams) !== JSON.stringify(job.params ?? {}) && {
          params: parsedParams,
        }),
    } as UpdateJobInput;

    if (Object.keys(input).length === 0) {
      toast.info('Нет изменений');
      return;
    }
    mutation.mutate(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job.name}</DialogTitle>
          <DialogDescription>{job.description ?? job.key}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cronExpr">Cron-выражение</Label>
              <Input
                id="cronExpr"
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="0 0 * * *"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Часовой пояс</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Moscow"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Активна
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="params">Параметры (JSON)</Label>
            <Textarea
              id="params"
              rows={6}
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              className="font-mono text-xs"
            />
            {paramsError ? (
              <p className="text-xs text-[var(--color-destructive)]">{paramsError}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
