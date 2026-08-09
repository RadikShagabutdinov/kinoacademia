import { Badge } from '@/components/ui/badge';
import type { JobStatus } from '@kinoacademia/shared';

const LABELS: Record<JobStatus, string> = {
  running: 'Выполняется',
  success: 'Успех',
  failed: 'Ошибка',
  skipped_idempotent: 'Пропущено',
};

const VARIANTS: Record<JobStatus, 'default' | 'success' | 'destructive' | 'secondary'> = {
  running: 'default',
  success: 'success',
  failed: 'destructive',
  skipped_idempotent: 'secondary',
};

type Props = { status: JobStatus };

export const JobStatusBadge = ({ status }: Props) => (
  <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>
);
