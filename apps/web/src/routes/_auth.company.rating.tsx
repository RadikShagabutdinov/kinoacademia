import { myCompanyQueryOptions } from '@/api/companies';
import { type CompanyRatingResponse, getCompanyRating } from '@/api/ratings';
import { CompanyHistoryList } from '@/components/features/company/CompanyHistoryList';
import { CompanyRatingCard } from '@/components/features/company/CompanyRatingCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useWsChannel } from '@/hooks/useWs';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';

const companyRatingQueryOptions = (companyId: string) =>
  queryOptions<CompanyRatingResponse>({
    queryKey: ['ratings', 'company', companyId],
    queryFn: () => getCompanyRating(companyId),
    staleTime: 15_000,
  });

export const Route = createFileRoute('/_auth/company/rating')({
  component: CompanyRatingPage,
  loader: async ({ context }) => {
    const company = context.queryClient.getQueryData(myCompanyQueryOptions.queryKey);
    if (!company) return;
    await context.queryClient.ensureQueryData(companyRatingQueryOptions(company.id));
  },
});

function CompanyRatingPage() {
  const { data: company } = useQuery(myCompanyQueryOptions);
  const qc = useQueryClient();

  const companyId = company?.id;
  const { data } = useQuery({
    ...companyRatingQueryOptions(companyId ?? ''),
    enabled: Boolean(companyId),
  });

  const onRatingEvent = useCallback(() => {
    if (!companyId) return;
    qc.invalidateQueries({ queryKey: ['ratings', 'company', companyId] });
  }, [qc, companyId]);

  useWsChannel(companyId ? `company:${companyId}` : null, onRatingEvent);

  if (!company || !data) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Рейтинг компании" backTo="/" overline={company.name} />
      <CompanyRatingCard rating={data.rating} />
      <CompanyHistoryList transactions={data.history} companyId={company.id} />
    </div>
  );
}
