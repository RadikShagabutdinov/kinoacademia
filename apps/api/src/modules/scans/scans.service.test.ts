import type { ContractKind } from '@kinoacademia/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../../storage';
import { ScanError } from './errors';

type StoredSet = {
  id: string;
  companyId: string;
  caption: string;
  createdByUserId: string | null;
  createdAt: Date;
};

type StoredPage = {
  id: string;
  setId: string;
  orderIdx: number;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
};

const scanSets = new Map<string, StoredSet>();
const scanPages: StoredPage[] = [];
const companies = new Map<string, { id: string; isSystem: boolean }>();
const contracts = new Map<string, { kind: ContractKind; personId: string; companyId: string }>();

vi.mock('../../db/client', () => {
  const fakeDb = {
    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb(fakeDb),
  };
  return { db: fakeDb, queryClient: { end: async () => {} } };
});

vi.mock('./scans-repo', async () => {
  return {
    insertScanSet: async (
      _exec: unknown,
      data: { companyId: string; caption: string; createdByUserId: string | null },
    ) => {
      const row: StoredSet = {
        id: crypto.randomUUID(),
        companyId: data.companyId,
        caption: data.caption,
        createdByUserId: data.createdByUserId,
        createdAt: new Date(),
      };
      scanSets.set(row.id, row);
      return row;
    },
    insertScanPage: async (
      _exec: unknown,
      data: {
        setId: string;
        orderIdx: number;
        filePath: string;
        mimeType: string;
        sizeBytes: number;
      },
    ) => {
      const row: StoredPage = {
        id: crypto.randomUUID(),
        ...data,
        uploadedAt: new Date(),
      };
      scanPages.push(row);
      return row;
    },
    findScanSetWithPages: async (_exec: unknown, setId: string) => {
      const s = scanSets.get(setId);
      if (!s) return null;
      const pages = scanPages
        .filter((p) => p.setId === setId)
        .sort((a, b) => a.orderIdx - b.orderIdx);
      return { ...s, pages, contract: null };
    },
    findScanPageById: async (_exec: unknown, pageId: string) => {
      const p = scanPages.find((x) => x.id === pageId);
      if (!p) return null;
      const s = scanSets.get(p.setId);
      return { ...p, companyId: s?.companyId ?? '' };
    },
    listScanSetsByCompany: async (_exec: unknown, companyId: string) => {
      const sets = [...scanSets.values()].filter((s) => s.companyId === companyId);
      return sets.map((s) => ({
        ...s,
        pages: scanPages.filter((p) => p.setId === s.id),
        contract: null,
      }));
    },
    deleteScanSet: async (_exec: unknown, setId: string) => {
      scanSets.delete(setId);
      for (let i = scanPages.length - 1; i >= 0; i--) {
        if (scanPages[i]?.setId === setId) scanPages.splice(i, 1);
      }
    },
    attachScanSetToContract: async (
      _exec: unknown,
      kind: ContractKind,
      contractId: string,
      _setId: string,
    ) => {
      const c = contracts.get(contractId);
      return Boolean(c && c.kind === kind);
    },
    findContractCompanyId: async (_exec: unknown, kind: ContractKind, id: string) => {
      const c = contracts.get(id);
      return c && c.kind === kind ? c.companyId : null;
    },
    findSystemCompanyId: async () => {
      for (const c of companies.values()) if (c.isSystem) return c.id;
      return null;
    },
    findCompanyById: async (_exec: unknown, id: string) => companies.get(id) ?? null,
    findContractPersonAndCompany: async (_exec: unknown, kind: ContractKind, id: string) => {
      const c = contracts.get(id);
      if (!c || c.kind !== kind) return null;
      return { personId: c.personId, companyId: c.companyId };
    },
  };
});

const savedKeys: string[] = [];
const deletedPaths: string[] = [];
let shouldFailSaveOnIndex: number | null = null;

const makeStorage = (): StorageAdapter => ({
  async save({ key, data }) {
    if (shouldFailSaveOnIndex !== null && savedKeys.length === shouldFailSaveOnIndex) {
      throw new Error('save-failed');
    }
    savedKeys.push(key);
    return { filePath: key, sizeBytes: data.byteLength };
  },
  async read(_filePath) {
    return {
      stream: null as unknown as never,
      mimeType: 'application/octet-stream',
      sizeBytes: 0,
    } as never;
  },
  async delete(filePath) {
    deletedPaths.push(filePath);
  },
});

const COMPANY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SYS_COMPANY_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTRACT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OTHER_PERSON_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

beforeEach(() => {
  scanSets.clear();
  scanPages.length = 0;
  companies.clear();
  contracts.clear();
  savedKeys.length = 0;
  deletedPaths.length = 0;
  shouldFailSaveOnIndex = null;
  companies.set(COMPANY_ID, { id: COMPANY_ID, isSystem: false });
  companies.set(SYS_COMPANY_ID, { id: SYS_COMPANY_ID, isSystem: true });
  contracts.set(CONTRACT_ID, {
    kind: 'permanent',
    personId: OTHER_PERSON_ID,
    companyId: COMPANY_ID,
  });
});

describe('scans.service — validation', () => {
  it('rejects empty file list', async () => {
    const { uploadScanSet } = await import('./scans.service');
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: COMPANY_ID,
          caption: 'X',
          files: [],
        },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'no_files' });
  });

  it('rejects more than SCAN_MAX_PAGES', async () => {
    const { uploadScanSet } = await import('./scans.service');
    const files = Array.from({ length: 5 }).map(() => ({
      buffer: Buffer.from('x'),
      mimeType: 'image/jpeg',
    }));
    await expect(
      uploadScanSet(
        { actorUserId: USER_ID, companyId: COMPANY_ID, caption: 'X', files },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'too_many_pages' });
  });

  it('rejects invalid mime type', async () => {
    const { uploadScanSet } = await import('./scans.service');
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: COMPANY_ID,
          caption: 'X',
          files: [{ buffer: Buffer.from('x'), mimeType: 'application/exe' }],
        },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'invalid_mime' });
  });

  it('rejects too-large file', async () => {
    const { uploadScanSet } = await import('./scans.service');
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: COMPANY_ID,
          caption: 'X',
          files: [{ buffer: big, mimeType: 'application/pdf' }],
        },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'too_large' });
  });

  it('rejects unknown company', async () => {
    const { uploadScanSet } = await import('./scans.service');
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          caption: 'X',
          files: [{ buffer: Buffer.from('x'), mimeType: 'image/jpeg' }],
        },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects contract from another company', async () => {
    const { uploadScanSet } = await import('./scans.service');
    contracts.set(CONTRACT_ID, {
      kind: 'permanent',
      personId: OTHER_PERSON_ID,
      companyId: SYS_COMPANY_ID,
    });
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: COMPANY_ID,
          caption: 'X',
          files: [{ buffer: Buffer.from('x'), mimeType: 'image/jpeg' }],
          contract: { kind: 'permanent', id: CONTRACT_ID },
        },
        { storage: makeStorage() },
      ),
    ).rejects.toMatchObject({ code: 'company_mismatch' });
  });
});

describe('scans.service — success path', () => {
  it('creates set + pages and writes files', async () => {
    const { uploadScanSet } = await import('./scans.service');
    const created = await uploadScanSet(
      {
        actorUserId: USER_ID,
        companyId: COMPANY_ID,
        caption: 'Договор',
        files: [
          { buffer: Buffer.from('pdf-content'), mimeType: 'application/pdf' },
          { buffer: Buffer.from('jpg-content'), mimeType: 'image/jpeg' },
        ],
      },
      { storage: makeStorage() },
    );
    expect(created.pages).toHaveLength(2);
    expect(created.pages[0]?.orderIdx).toBe(0);
    expect(created.pages[1]?.orderIdx).toBe(1);
    expect(savedKeys).toHaveLength(2);
    expect(deletedPaths).toHaveLength(0);
  });

  it('attaches to contract when provided', async () => {
    const { uploadScanSet } = await import('./scans.service');
    const created = await uploadScanSet(
      {
        actorUserId: USER_ID,
        companyId: COMPANY_ID,
        caption: 'X',
        files: [{ buffer: Buffer.from('x'), mimeType: 'image/jpeg' }],
        contract: { kind: 'permanent', id: CONTRACT_ID },
      },
      { storage: makeStorage() },
    );
    expect(created.contract).toEqual({ kind: 'permanent', id: CONTRACT_ID });
  });
});

describe('scans.service — rollback', () => {
  it('deletes already-saved files if a subsequent save fails', async () => {
    const { uploadScanSet } = await import('./scans.service');
    shouldFailSaveOnIndex = 1;
    await expect(
      uploadScanSet(
        {
          actorUserId: USER_ID,
          companyId: COMPANY_ID,
          caption: 'X',
          files: [
            { buffer: Buffer.from('a'), mimeType: 'image/jpeg' },
            { buffer: Buffer.from('b'), mimeType: 'image/jpeg' },
          ],
        },
        { storage: makeStorage() },
      ),
    ).rejects.toThrow(/save-failed/);
    expect(deletedPaths).toEqual(expect.arrayContaining(savedKeys));
    expect(scanSets.size).toBe(0);
    expect(scanPages).toHaveLength(0);
  });
});

describe('scans.access', () => {
  it('canReadScanSet — admin/info always allowed for non-system', async () => {
    const { canReadScanSet } = await import('./access');
    expect(
      await canReadScanSet(
        { id: 'x', role: 'admin' },
        { companyId: COMPANY_ID, contract: null, isSystemCompany: false },
      ),
    ).toBe(true);
    expect(
      await canReadScanSet(
        { id: 'x', role: 'info' },
        { companyId: COMPANY_ID, contract: null, isSystemCompany: false },
      ),
    ).toBe(true);
  });

  it('canReadScanSet — system set is readable by anyone', async () => {
    const { canReadScanSet } = await import('./access');
    expect(
      await canReadScanSet(
        { id: 'x', role: 'emp' },
        { companyId: SYS_COMPANY_ID, contract: null, isSystemCompany: true },
      ),
    ).toBe(true);
  });

  it('canManageScanSetForCompany — only admin/info for system', async () => {
    const { canManageScanSetForCompany } = await import('./access');
    expect(await canManageScanSetForCompany({ id: 'x', role: 'head' }, COMPANY_ID, true)).toBe(
      false,
    );
    expect(await canManageScanSetForCompany({ id: 'x', role: 'admin' }, COMPANY_ID, true)).toBe(
      true,
    );
    expect(await canManageScanSetForCompany({ id: 'x', role: 'info' }, COMPANY_ID, true)).toBe(
      true,
    );
  });

  it('canManageScanSetForCompany — non-head/admin cannot upload to non-system', async () => {
    const { canManageScanSetForCompany } = await import('./access');
    expect(await canManageScanSetForCompany({ id: 'x', role: 'emp' }, COMPANY_ID, false)).toBe(
      false,
    );
    expect(await canManageScanSetForCompany({ id: 'x', role: 'info' }, COMPANY_ID, false)).toBe(
      false,
    );
  });
});

describe('scans.errors', () => {
  it('ScanError.code preserved and status mapped', async () => {
    const { scanErrorStatus } = await import('./errors');
    const err = new ScanError('too_large', 'oops');
    expect(err.code).toBe('too_large');
    expect(scanErrorStatus('too_large')).toBe(400);
    expect(scanErrorStatus('not_found')).toBe(404);
    expect(scanErrorStatus('forbidden')).toBe(403);
    expect(scanErrorStatus('company_mismatch')).toBe(409);
  });
});
