import { listAllOscars } from '@/api/oscars';
import { AdminLayout } from '@/components/features/admin/AdminLayout';
import { AwardOscarButton } from '@/components/features/admin/oscars/AwardOscarButton';
import { SubmitContributionForm } from '@/components/features/admin/oscars/SubmitContributionForm';
import { NominationsTable } from '@/components/features/oscars/NominationsTable';
import { WithdrawNominationButton } from '@/components/features/oscars/WithdrawNominationButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWsChannel } from '@/hooks/useWs';
import { computeNominationCost } from '@kinoacademia/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Award } from 'lucide-react';
import { useCallback } from 'react';

export const Route = createFileRoute('/_auth/admin/oscars')({
  component: AdminOscarsPage,
});

function AdminOscarsPage() {
  const qc = useQueryClient();
  const onOscarEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['oscars'] });
  }, [qc]);
  useWsChannel('oscars', onOscarEvent);

  const { data = [], isPending } = useQuery({
    queryKey: ['oscars', 'all'],
    queryFn: listAllOscars,
  });

  return (
    <AdminLayout title="Оскары" description="Управление номинациями и присуждение побед.">
      <Tabs defaultValue="nominations">
        <TabsList>
          <TabsTrigger value="nominations">Номинации</TabsTrigger>
          <TabsTrigger value="contribution">Закрытая номинация</TabsTrigger>
        </TabsList>

        <TabsContent value="nominations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[var(--color-star)]" />
                Поданные номинации
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isPending ? (
                <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>
              ) : (
                <NominationsTable
                  rows={data}
                  actionsHeader="Действия"
                  renderActions={(row) => (
                    <div className="flex items-start gap-2">
                      <AwardOscarButton row={row} />
                      <WithdrawNominationButton
                        row={row}
                        refund={computeNominationCost(
                          data.filter((r) => r.companyId && r.companyId === row.companyId).length -
                            1,
                        )}
                      />
                    </div>
                  )}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contribution">
          <Card>
            <CardHeader>
              <CardTitle>Закрытая номинация</CardTitle>
            </CardHeader>
            <CardContent>
              <SubmitContributionForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
