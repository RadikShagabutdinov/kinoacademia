import { api } from '@/api/client';
import type {
  JobDefinitionDto,
  JobDefinitionWithLastRunDto,
  JobKey,
  JobRunDto,
  JobStatus,
  UpdateJobInput,
} from '@kinoacademia/shared';

export const listJobs = (): Promise<JobDefinitionWithLastRunDto[]> =>
  api.get<JobDefinitionWithLastRunDto[]>('/admin/jobs/');

export const getJob = (key: JobKey): Promise<JobDefinitionWithLastRunDto> =>
  api.get<JobDefinitionWithLastRunDto>(`/admin/jobs/${key}`);

export const updateJob = (key: JobKey, input: UpdateJobInput): Promise<JobDefinitionDto> =>
  api.patch<JobDefinitionDto>(`/admin/jobs/${key}`, input);

export const runJobNow = (key: JobKey): Promise<{ slot: string }> =>
  api.post<{ slot: string }>(`/admin/jobs/${key}/run`);

export type JobRunsFilter = {
  limit?: number;
  status?: JobStatus;
};

export const listJobRuns = (key: JobKey, filter: JobRunsFilter = {}): Promise<JobRunDto[]> => {
  const params = new URLSearchParams();
  if (filter.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter.status) params.set('status', filter.status);
  const qs = params.toString();
  return api.get<JobRunDto[]>(`/admin/jobs/${key}/runs${qs ? `?${qs}` : ''}`);
};
