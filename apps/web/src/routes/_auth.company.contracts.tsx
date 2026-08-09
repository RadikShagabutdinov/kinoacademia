import { myCompanyQueryOptions } from '@/api/companies';
import { getCompanyContracts } from '@/api/contracts';
import { CompanyContractCard } from '@/components/features/company/CompanyContractCard';
import { CreateContractDialog } from '@/components/features/company/CreateContractDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { NoticeBox } from '@/components/ui/notice-box';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MonoValue } from '@/components/ui/typography';
import { useOpenPersons } from '@/hooks/useOpenPersons';
import { useWsChannel } from '@/hooks/useWs';
import {
  ACTIVE_CONTRACT_STATUSES,
  type ContractDto,
  TERMINAL_CONTRACT_STATUSES,
} from '@kinoacademia/shared';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const companyContractsQueryOptions = (companyId: string) =>
  queryOptions<ContractDto[]>({
    queryKey: ['contracts', 'company', companyId],
    queryFn: () => getCompanyContracts(companyId),
    staleTime: 15_000,
  });

export const Route = createFileRoute('/_auth/company/contracts')({
  component: CompanyContractsPage,
  loader: async ({ context }) => {
    const company = context.queryClient.getQueryData(myCompanyQueryOptions.queryKey);
    if (!company) return;
    await context.queryClient.ensureQueryData(companyContractsQueryOptions(company.id));
  },
});

function CompanyContractsPage() {
  const { data: company } = useQuery(myCompanyQueryOptions);
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const companyId = company?.id;
  const { data: contracts = [] } = useQuery({
    ...companyContractsQueryOptions(companyId ?? ''),
    enabled: Boolean(companyId),
  });

  const { data: persons = [] } = useOpenPersons();
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p.displayName])), [persons]);

  const onContractEvent = useCallback(() => {
    if (!companyId) return;
    qc.invalidateQueries({ queryKey: ['contracts', 'company', companyId] });
  }, [qc, companyId]);

  useWsChannel(companyId ? `company:${companyId}` : null, onContractEvent);

  const groups = useMemo(() => {
    const drafts: ContractDto[] = [];
    const active: ContractDto[] = [];
    const archive: ContractDto[] = [];
    for (const c of contracts) {
      if (TERMINAL_CONTRACT_STATUSES.includes(c.statusCode)) archive.push(c);
      else if (c.statusCode === 'draft') drafts.push(c);
      else if (ACTIVE_CONTRACT_STATUSES.includes(c.statusCode)) active.push(c);
    }
    return { drafts, active, archive };
  }, [contracts]);

  if (!companyId) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Контракты компании"
        backTo="/"
        overline={company?.name ?? ''}
        actions={
          <Button size="icon" onClick={() => setCreateOpen(true)} aria-label="Новый контракт">
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Активные <MonoValue>{groups.active.length}</MonoValue>
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Черновики <MonoValue>{groups.drafts.length}</MonoValue>
          </TabsTrigger>
          <TabsTrigger value="archive">
            Архив <MonoValue>{groups.archive.length}</MonoValue>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ContractGrid
            items={groups.active}
            companyId={companyId}
            personById={personById}
            emptyText="Активных контрактов нет."
          />
        </TabsContent>
        <TabsContent value="drafts">
          <ContractGrid
            items={groups.drafts}
            companyId={companyId}
            personById={personById}
            emptyText="Черновиков нет."
          />
        </TabsContent>
        <TabsContent value="archive">
          <ContractGrid
            items={groups.archive}
            companyId={companyId}
            personById={personById}
            emptyText="Архив пуст."
          />
        </TabsContent>
      </Tabs>

      <CreateContractDialog companyId={companyId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

type ContractGridProps = {
  items: ContractDto[];
  companyId: string;
  personById: Map<string, string>;
  emptyText: string;
};

const ContractGrid = ({ items, companyId, personById, emptyText }: ContractGridProps) => {
  if (items.length === 0) {
    return <NoticeBox tone="muted">{emptyText}</NoticeBox>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c) => {
        const personName = personById.get(c.personId);
        return (
          <CompanyContractCard
            key={c.id}
            contract={c}
            companyId={companyId}
            {...(personName ? { personName } : {})}
          />
        );
      })}
    </div>
  );
};
