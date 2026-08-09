import { Badge } from '@/components/ui/badge';
import { CONTRACT_STATUS_LABELS, type ContractStatusCode } from '@kinoacademia/shared';

type Props = {
  status: ContractStatusCode;
};

type Tone = 'outline' | 'warning' | 'success' | 'destructive';

// Тон отражает, чего статус требует от пользователя: warning — ждёт решения,
// success — контракт действует, destructive — расторгнут или отклонён.
const STATUS_TONE: Record<ContractStatusCode, Tone> = {
  draft: 'outline',
  sent: 'warning',
  confirmed: 'success',
  rejected: 'destructive',
  breakup_sent: 'warning',
  breakup_confirmed: 'outline',
  breakup_rejected: 'warning',
  broken_company: 'destructive',
  broken_person: 'destructive',
};

export const ContractStatusBadge = ({ status }: Props) => (
  <Badge variant={STATUS_TONE[status]} className="whitespace-nowrap">
    {CONTRACT_STATUS_LABELS[status]}
  </Badge>
);
