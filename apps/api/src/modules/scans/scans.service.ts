import { randomUUID } from 'node:crypto';
import {
  SCAN_ALLOWED_MIME,
  SCAN_MAX_FILE_SIZE,
  SCAN_MAX_PAGES,
  type ScanContractRef,
  type ScanMime,
  type ScanPageDto,
  type ScanSetDto,
} from '@kinoacademia/shared';
import { db } from '../../db/client';
import { getScansStorage } from '../../storage';
import type { StorageAdapter } from '../../storage';
import { ScanError } from './errors';
import * as repo from './scans-repo';
import type { ScanPageRow, ScanSetRow, ScanSetWithPagesRow } from './scans-repo';

export type UploadScanFile = {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
};

export type UploadScanSetInput = {
  actorUserId: string;
  companyId: string;
  caption: string;
  contract?: ScanContractRef;
  files: UploadScanFile[];
};

const isAllowedMime = (mime: string): mime is ScanMime =>
  (SCAN_ALLOWED_MIME as readonly string[]).includes(mime);

const extForMime = (mime: ScanMime): string => (mime === 'application/pdf' ? 'pdf' : 'jpg');

const validateFiles = (files: UploadScanFile[]): void => {
  if (files.length === 0) {
    throw new ScanError('no_files', 'At least one file is required');
  }
  if (files.length > SCAN_MAX_PAGES) {
    throw new ScanError('too_many_pages', `Maximum ${SCAN_MAX_PAGES} pages per scan set`);
  }
  for (const f of files) {
    if (!isAllowedMime(f.mimeType)) {
      throw new ScanError('invalid_mime', `Unsupported mime type: ${f.mimeType}`);
    }
    if (f.buffer.byteLength > SCAN_MAX_FILE_SIZE) {
      throw new ScanError('too_large', `File exceeds ${SCAN_MAX_FILE_SIZE} bytes`);
    }
  }
};

export const toScanPageDto = (row: ScanPageRow): ScanPageDto => ({
  id: row.id,
  setId: row.setId,
  orderIdx: row.orderIdx,
  mimeType: row.mimeType as ScanMime,
  sizeBytes: row.sizeBytes,
  uploadedAt: row.uploadedAt.toISOString(),
});

export const toScanSetDto = (row: ScanSetWithPagesRow): ScanSetDto => ({
  id: row.id,
  companyId: row.companyId,
  caption: row.caption,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  pages: row.pages.map(toScanPageDto),
  contract: row.contract,
});

/**
 * Загружает пакет сканов. Стратегия отката:
 * 1) генерируем ключи файлов заранее (без записи в БД);
 * 2) сохраняем файлы через StorageAdapter, накапливая список записанных путей;
 * 3) в транзакции создаём scan_set + scan_pages + опциональную привязку к контракту;
 * 4) при любой ошибке — удаляем уже сохранённые файлы.
 */
export const uploadScanSet = async (
  input: UploadScanSetInput,
  overrides?: { storage?: StorageAdapter },
): Promise<ScanSetWithPagesRow> => {
  validateFiles(input.files);

  const company = await repo.findCompanyById(db, input.companyId);
  if (!company) {
    throw new ScanError('not_found', 'Company not found');
  }

  if (input.contract) {
    const contract = await repo.findContractPersonAndCompany(
      db,
      input.contract.kind,
      input.contract.id,
    );
    if (!contract) throw new ScanError('not_found', 'Contract not found');
    if (contract.companyId !== input.companyId) {
      throw new ScanError('company_mismatch', 'Contract belongs to another company');
    }
  }

  const storage = overrides?.storage ?? getScansStorage();
  const setId = randomUUID();

  const preparedPages = input.files.map((file, idx) => {
    const pageId = randomUUID();
    const ext = extForMime(file.mimeType as ScanMime);
    return {
      pageId,
      orderIdx: idx,
      key: `${input.companyId}/${setId}/${pageId}.${ext}`,
      buffer: file.buffer,
      mimeType: file.mimeType as ScanMime,
    };
  });

  const savedPaths: string[] = [];
  const savedPages: Array<{
    orderIdx: number;
    filePath: string;
    sizeBytes: number;
    mimeType: ScanMime;
    pageId: string;
  }> = [];

  try {
    for (const p of preparedPages) {
      const stored = await storage.save({ key: p.key, data: p.buffer, mimeType: p.mimeType });
      savedPaths.push(stored.filePath);
      savedPages.push({
        orderIdx: p.orderIdx,
        filePath: stored.filePath,
        sizeBytes: stored.sizeBytes,
        mimeType: p.mimeType,
        pageId: p.pageId,
      });
    }

    return await db.transaction(async (tx) => {
      const setRow = await repo.insertScanSet(tx, {
        companyId: input.companyId,
        caption: input.caption,
        createdByUserId: input.actorUserId,
      });

      const pageRows: ScanPageRow[] = [];
      for (const p of savedPages) {
        const inserted = await repo.insertScanPage(tx, {
          setId: setRow.id,
          orderIdx: p.orderIdx,
          filePath: p.filePath,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
        });
        pageRows.push(inserted);
      }

      let contractRef: ScanContractRef | null = null;
      if (input.contract) {
        const attached = await repo.attachScanSetToContract(
          tx,
          input.contract.kind,
          input.contract.id,
          setRow.id,
        );
        if (!attached) throw new ScanError('not_found', 'Contract not found');
        contractRef = { kind: input.contract.kind, id: input.contract.id };
      }

      return {
        ...setRow,
        pages: pageRows,
        contract: contractRef,
      } satisfies ScanSetWithPagesRow;
    });
  } catch (err) {
    await Promise.allSettled(savedPaths.map((p) => storage.delete(p)));
    throw err;
  }
};

export const listCompanyScanSets = async (companyId: string): Promise<ScanSetWithPagesRow[]> => {
  return repo.listScanSetsByCompany(db, companyId);
};

export const listSystemScanSets = async (): Promise<{
  companyId: string;
  sets: ScanSetWithPagesRow[];
}> => {
  const companyId = await repo.findSystemCompanyId(db);
  if (!companyId) return { companyId: '', sets: [] };
  const sets = await repo.listScanSetsByCompany(db, companyId);
  return { companyId, sets };
};

export const getScanSet = async (setId: string): Promise<ScanSetWithPagesRow> => {
  const set = await repo.findScanSetWithPages(db, setId);
  if (!set) throw new ScanError('not_found', 'Scan set not found');
  return set;
};

export const getScanPage = async (pageId: string) => {
  const page = await repo.findScanPageById(db, pageId);
  if (!page) throw new ScanError('not_found', 'Scan page not found');
  return page;
};

export const deleteScanSet = async (setId: string): Promise<ScanSetWithPagesRow> => {
  const set = await repo.findScanSetWithPages(db, setId);
  if (!set) throw new ScanError('not_found', 'Scan set not found');

  const storage = getScansStorage();
  await db.transaction(async (tx) => {
    await repo.deleteScanSet(tx, setId);
  });
  await Promise.allSettled(set.pages.map((p) => storage.delete(p.filePath)));
  return set;
};

export const getScanSetOwnerContext = async (
  setId: string,
): Promise<{ set: ScanSetWithPagesRow; isSystemCompany: boolean }> => {
  const set = await getScanSet(setId);
  const company = await repo.findCompanyById(db, set.companyId);
  return { set, isSystemCompany: company?.isSystem ?? false };
};

export const getSystemCompanyId = () => repo.findSystemCompanyId(db);

export const isSystemCompany = async (companyId: string): Promise<boolean> => {
  const company = await repo.findCompanyById(db, companyId);
  return company?.isSystem ?? false;
};

// Экспорт «сырого» ScanSetRow типа наружу для роутов, если понадобится.
export type { ScanPageRow, ScanSetRow, ScanSetWithPagesRow };
