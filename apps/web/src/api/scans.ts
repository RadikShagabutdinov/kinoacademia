import type { ContractKind, ScanSetDto } from '@kinoacademia/shared';
import { api, apiRequest } from './client';

export type UploadScanSetInput = {
  companyId: string;
  caption: string;
  files: File[];
  contract?: { kind: ContractKind; id: string };
};

export const listCompanyScanSets = (companyId: string): Promise<ScanSetDto[]> =>
  api.get<ScanSetDto[]>(`/scans/company/${companyId}`);

export type DefaultScansResponse = { companyId: string | null; sets: ScanSetDto[] };

export const listDefaultScanSets = (): Promise<DefaultScansResponse> =>
  api.get<DefaultScansResponse>('/scans/default');

export const getScanSet = (setId: string): Promise<ScanSetDto> =>
  api.get<ScanSetDto>(`/scans/set/${setId}`);

export const uploadScanSet = (input: UploadScanSetInput): Promise<ScanSetDto> => {
  const form = new FormData();
  form.append('companyId', input.companyId);
  form.append('caption', input.caption);
  if (input.contract) {
    form.append('contractKind', input.contract.kind);
    form.append('contractId', input.contract.id);
  }
  for (const f of input.files) {
    form.append('files', f, f.name);
  }
  return apiRequest<ScanSetDto>('/scans', { method: 'POST', body: form });
};

export const deleteScanSet = (setId: string): Promise<void> =>
  api.delete<void>(`/scans/set/${setId}`);

export const scanPageUrl = (pageId: string): string => {
  const raw = import.meta.env.VITE_API_URL?.trim();
  const base = raw && raw.length > 0 ? (raw.endsWith('/') ? raw.slice(0, -1) : raw) : '/api';
  return `${base}/scans/page/${pageId}`;
};
