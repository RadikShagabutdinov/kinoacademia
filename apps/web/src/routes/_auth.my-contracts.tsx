import { getMyContracts } from '@/api/contracts';
import { ContractCard } from '@/components/features/contracts/ContractCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMe } from '@/hooks/useMe';
import { useWsChannel } from '@/hooks/useWs';
import {
  ACTIVE_CONTRACT_STATUSES,
  type ContractDto,
  TERMINAL_CONTRACT_STATUSES,
} from '@kinoacademia/shared';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

const myContractsQueryOptions = queryOptions<ContractDto[]>({
  queryKey: ['contracts', 'my'],
  queryFn: getMyContracts,
  staleTime: 15_000,
});

export const Route = createFileRoute('/_auth/my-contracts')({
  component: MyContractsPage,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(myContractsQueryOptions);
  },
});

function MyContractsPage() {
  const { data: me } = useMe();
  const { data: contracts = [] } = useQuery(myContractsQueryOptions);
  const qc = useQueryClient();

  const onContractEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['contracts', 'my'] });
  }, [qc]);

  useWsChannel(me?.user.id ? 'contracts:my' : null, onContractEvent);

  const groups = useMemo(() => {
    const permanent: ContractDto[] = [];
    const temporary: ContractDto[] = [];
    const archive: ContractDto[] = [];
    for (const c of contracts) {
      if (TERMINAL_CONTRACT_STATUSES.includes(c.statusCode)) {
        archive.push(c);
        continue;
      }
      if (ACTIVE_CONTRACT_STATUSES.includes(c.statusCode)) {
        if (c.kind === 'permanent') permanent.push(c);
        else temporary.push(c);
      }
    }
    return { permanent, temporary, archive };
  }, [contracts]);

  if (!me?.person) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет активного персонажа</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted-fg)]">
          Дождитесь, пока администратор назначит вам персонажа.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Мои контракты</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">{me.person.displayName}</p>
      </header>

      <Tabs defaultValue="permanent">
        <TabsList>
          <TabsTrigger value="permanent">Постоянный ({groups.permanent.length})</TabsTrigger>
          <TabsTrigger value="temporary">Временные ({groups.temporary.length})</TabsTrigger>
          <TabsTrigger value="archive">Архив ({groups.archive.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="permanent">
          <ContractList items={groups.permanent} emptyText="Постоянного контракта пока нет." />
        </TabsContent>
        <TabsContent value="temporary">
          <ContractList items={groups.temporary} emptyText="Временных контрактов нет." />
        </TabsContent>
        <TabsContent value="archive">
          <ContractList items={groups.archive} emptyText="Архив пуст." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ContractListProps = {
  items: ContractDto[];
  emptyText: string;
};

const ContractList = ({ items, emptyText }: ContractListProps) => {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-muted-fg)]">{emptyText}</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c) => (
        <ContractCard key={c.id} contract={c} />
      ))}
    </div>
  );
};
