import { submitNomination } from '@/api/oscars';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { NoticeBox } from '@/components/ui/notice-box';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { getApiErrorMessage } from '@/lib/apiError';
import { NOMINATION_LABELS } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Закрытая номинация «За вклад в киноискусство». Присуждается администратором
 * напрямую персонажу, без фильма и компании. Сразу даёт +50 за номинацию;
 * админ дополнительно может вручную присудить победу через таблицу.
 */
export const SubmitContributionForm = () => {
  const qc = useQueryClient();
  const { data: persons = [] } = useOpenPersons();
  const [filter, setFilter] = useState('');
  const [personId, setPersonId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = filter
    ? persons.filter((p) => p.displayName.toLowerCase().includes(filter.toLowerCase()))
    : persons;

  const mutation = useMutation({
    mutationFn: () =>
      submitNomination({
        personId,
        nominationCode: 'contribution',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oscars'] });
      setPersonId('');
      setError(null);
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Не удалось подать номинацию'));
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
    <div className="grid gap-3">
      <p className="text-sm text-[var(--color-muted-fg)]">
        Категория «{NOMINATION_LABELS.contribution}» — закрытая, не привязывается к фильму и не
        доступна кинокомпаниям.
      </p>

      <div className="grid gap-2">
        <Label htmlFor="contribution-search">Поиск по имени</Label>
        <Input
          id="contribution-search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Часть имени персонажа"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contribution-person">Персонаж</Label>
        <NativeSelect
          id="contribution-person"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">— Выберите —</option>
          {filtered.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error && <NoticeBox tone="danger">{error}</NoticeBox>}

      <div>
        <Button onClick={handleSubmit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Подаём…' : 'Подать номинацию'}
        </Button>
      </div>
    </div>
  );
};
