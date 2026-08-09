import { updatePerson } from '@/api/admin/persons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { getApiErrorMessage } from '@/lib/apiError';
import { type PersonDossierDto, RACE_LABELS, ROLE_LABELS } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LockOpen, ShieldX } from 'lucide-react';
import { ConfirmDangerDialog } from '../ConfirmDangerDialog';
import { EditPersonDialog } from './EditPersonDialog';

type Props = { dossier: PersonDossierDto };

export const DossierHeader = ({ dossier }: Props) => {
  const qc = useQueryClient();

  const closeMutation = useMutation({
    mutationFn: () => updatePerson(dossier.id, { isOpen: false }),
    onSuccess: () => {
      toast.success('Персонаж закрыт');
      qc.invalidateQueries({ queryKey: ['admin', 'persons'] });
      qc.invalidateQueries({ queryKey: ['admin', 'person-dossier', dossier.id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  const openMutation = useMutation({
    mutationFn: () => updatePerson(dossier.id, { isOpen: true }),
    onSuccess: () => {
      toast.success('Персонаж открыт');
      qc.invalidateQueries({ queryKey: ['admin', 'persons'] });
      qc.invalidateQueries({ queryKey: ['admin', 'person-dossier', dossier.id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Ошибка')),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-xl">{dossier.displayName}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted-fg)]">
            <Badge variant="outline">{RACE_LABELS[dossier.raceCode]}</Badge>
            <Badge variant="outline">{ROLE_LABELS[dossier.roleCode]}</Badge>
            {dossier.age !== null ? <span>Возраст: {dossier.age}</span> : null}
            {dossier.isStar ? <Badge variant="warning">Звезда</Badge> : null}
            {dossier.isOpen ? (
              <Badge variant="success">Открыт</Badge>
            ) : (
              <Badge variant="secondary">Закрыт</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row">
          <EditPersonDialog person={dossier} />
          {dossier.isOpen ? (
            <ConfirmDangerDialog
              trigger={
                <Button variant="outline" size="sm">
                  <ShieldX className="mr-1 h-4 w-4" />
                  Закрыть
                </Button>
              }
              title="Закрыть персонажа?"
              description="После закрытия персонаж перестанет участвовать в игре."
              confirmLabel="Закрыть"
              isLoading={closeMutation.isPending}
              onConfirm={() => closeMutation.mutateAsync()}
            />
          ) : (
            <ConfirmDangerDialog
              trigger={
                <Button variant="outline" size="sm">
                  <LockOpen className="mr-1 h-4 w-4" />
                  Открыть
                </Button>
              }
              title="Открыть персонажа?"
              variant="default"
              confirmLabel="Открыть"
              isLoading={openMutation.isPending}
              onConfirm={() => openMutation.mutateAsync()}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {dossier.user ? (
          <div>
            Привязка к пользователю: <span className="font-medium">{dossier.user.login}</span> (
            {ROLE_LABELS[dossier.user.roleCode]})
          </div>
        ) : (
          <div className="text-[var(--color-muted-fg)]">Не привязан к пользователю</div>
        )}
      </CardContent>
    </Card>
  );
};
