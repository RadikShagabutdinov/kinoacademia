import { Readable } from 'node:stream';
import { createRoute, z } from '@hono/zod-openapi';
import {
  type ApiError,
  ContractKind,
  SCAN_ALLOWED_MIME,
  SCAN_MAX_FILE_SIZE,
  SCAN_MAX_PAGES,
  ScanSetDto,
  Uuid,
} from '@kinoacademia/shared';
import type { Context } from 'hono';
import { requireAuth, requireRole } from '../auth/middleware';
import { writeAudit } from '../modules/audit/audit-repo';
import { canManageScanSetForCompany, canReadScanSet } from '../modules/scans/access';
import { ScanError, scanErrorStatus } from '../modules/scans/errors';
import * as scans from '../modules/scans/scans.service';
import { createOpenAPIApp } from '../openapi/app';
import { apiError, errorResponses } from '../openapi/responses';
import { getScansStorage } from '../storage';

const handleScanError = (c: Context, err: unknown) => {
  if (err instanceof ScanError) {
    const status = scanErrorStatus(err.code);
    const apiCode: ApiError['code'] =
      status === 404
        ? 'not_found'
        : status === 403
          ? 'forbidden'
          : status === 400
            ? 'bad_request'
            : 'conflict';
    const body = {
      code: apiCode,
      message: err.message,
      details: { scanCode: err.code },
    } satisfies ApiError;
    // Разветвление по литералам обязательно: c.json(body, <union>) склеивает
    // статусы в одно поле _status, и ответ перестаёт подходить под роут.
    switch (status) {
      case 400:
        return c.json(body, 400);
      case 403:
        return c.json(body, 403);
      case 404:
        return c.json(body, 404);
      case 409:
        return c.json(body, 409);
    }
  }
  throw err;
};

const SetIdParam = z.object({ setId: Uuid });
const PageIdParam = z.object({ pageId: Uuid });
const CompanyIdParam = z.object({ companyId: Uuid });

const uploadScanRoute = createRoute({
  middleware: [requireRole('head', 'info', 'admin')] as const,
  method: 'post',
  path: '/',
  tags: ['scans'],
  summary: 'Upload a scan set (multipart)',
  description:
    'Upload from 1 to 4 files (jpeg or pdf, up to 10MB each) as a single scan set. Fields: companyId, caption, files[], optional contractKind + contractId.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z
            .object({
              companyId: Uuid,
              caption: z.string().min(1).max(200),
              contractKind: ContractKind.optional(),
              contractId: Uuid.optional(),
              // Hono-валидатор multipart отдаёт одиночное поле как File, а повторяющееся —
              // как File[], поэтому схема принимает оба варианта: количество и mime
              // проверяются в хендлере/сервисе. В спеке поле остаётся массивом файлов.
              files: z.union([z.any(), z.array(z.any())]).openapi({
                type: 'array',
                items: { type: 'string', format: 'binary' },
                maxItems: SCAN_MAX_PAGES,
              }),
            })
            .openapi('UploadScanSetForm'),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Scan set created',
      content: { 'application/json': { schema: ScanSetDto.openapi('ScanSetDto') } },
    },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
  },
});

const listCompanyScanSetsRoute = createRoute({
  method: 'get',
  path: '/company/:companyId',
  tags: ['scans'],
  summary: 'List scan sets of a company',
  security: [{ cookieAuth: [] }],
  request: { params: CompanyIdParam },
  responses: {
    200: {
      description: 'Company scan sets',
      content: {
        'application/json': { schema: z.array(ScanSetDto).openapi('ScanSetList') },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const DefaultScansResponse = z.object({
  companyId: z.string().nullable(),
  sets: z.array(ScanSetDto),
});

const listDefaultScanSetsRoute = createRoute({
  method: 'get',
  path: '/default',
  tags: ['scans'],
  summary: 'List default (system) scan sets',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: 'System scan sets with system companyId',
      content: {
        'application/json': { schema: DefaultScansResponse.openapi('DefaultScansResponse') },
      },
    },
    401: errorResponses[401],
  },
});

const getScanSetRoute = createRoute({
  method: 'get',
  path: '/set/:setId',
  tags: ['scans'],
  summary: 'Get scan set metadata',
  security: [{ cookieAuth: [] }],
  request: { params: SetIdParam },
  responses: {
    200: {
      description: 'Scan set',
      content: { 'application/json': { schema: ScanSetDto } },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    400: errorResponses[400],
    409: errorResponses[409],
  },
});

const getScanPageRoute = createRoute({
  method: 'get',
  path: '/page/:pageId',
  tags: ['scans'],
  summary: 'Download scan page (stream)',
  security: [{ cookieAuth: [] }],
  request: { params: PageIdParam },
  responses: {
    200: {
      description: 'File stream',
      content: {
        'application/octet-stream': { schema: z.string().openapi({ format: 'binary' }) },
      },
    },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

const deleteScanSetRoute = createRoute({
  method: 'delete',
  path: '/set/:setId',
  tags: ['scans'],
  summary: 'Delete scan set',
  security: [{ cookieAuth: [] }],
  request: { params: SetIdParam },
  responses: {
    204: { description: 'Deleted' },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

export const scansRoutes = createOpenAPIApp();

scansRoutes.use('*', requireAuth);

// Разбор тела делает c.req.parseBody({ all: true }), а не результат zod-openapi
// валидатора: только так несколько файлов под одним ключом приходят массивом.
scansRoutes.openapi(uploadScanRoute, async (c) => {
  const user = c.get('user');
  let body: Record<string, string | File | (string | File)[]>;
  try {
    body = await c.req.parseBody({ all: true });
  } catch (_err) {
    return apiError(c, 400, { code: 'bad_request', message: 'Invalid multipart body' });
  }

  const companyId = typeof body.companyId === 'string' ? body.companyId : undefined;
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  const contractKindRaw = typeof body.contractKind === 'string' ? body.contractKind : undefined;
  const contractId = typeof body.contractId === 'string' ? body.contractId : undefined;

  if (!companyId || !Uuid.safeParse(companyId).success) {
    return apiError(c, 400, { code: 'validation_error', message: 'companyId is required (uuid)' });
  }
  if (!caption) {
    return apiError(c, 400, { code: 'validation_error', message: 'caption is required' });
  }

  const contractKindParsed = contractKindRaw ? ContractKind.safeParse(contractKindRaw) : undefined;
  if (contractKindRaw && contractKindParsed && !contractKindParsed.success) {
    return apiError(c, 400, { code: 'validation_error', message: 'invalid contractKind' });
  }
  if ((contractKindRaw && !contractId) || (contractId && !contractKindRaw)) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'contractKind and contractId must be provided together',
    });
  }

  const rawFiles: File[] = [];
  const collect = (v: unknown) => {
    if (v instanceof File) rawFiles.push(v);
  };
  if (Array.isArray(body.files)) body.files.forEach(collect);
  else if (body.files) collect(body.files);
  // Совместимость: files[], file, files
  for (const [key, val] of Object.entries(body)) {
    if (key === 'files') continue;
    if (key.startsWith('files')) {
      if (Array.isArray(val)) val.forEach(collect);
      else collect(val);
    }
  }

  const isSystem = await scans.isSystemCompany(companyId);
  const allowed = await canManageScanSetForCompany(user, companyId, isSystem);
  if (!allowed) {
    return apiError(c, 403, { code: 'forbidden', message: 'Cannot upload to this company' });
  }
  // Для системной компании контракт не поддерживается.
  if (isSystem && contractKindRaw) {
    return apiError(c, 400, {
      code: 'validation_error',
      message: 'System (default) sets cannot be attached to a contract',
    });
  }

  try {
    const files = await Promise.all(
      rawFiles.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type || 'application/octet-stream',
        originalName: f.name,
      })),
    );

    // Ранняя проверка размера — до передачи в service, чтобы не аллоцировать бесполезно.
    for (const f of files) {
      if (!(SCAN_ALLOWED_MIME as readonly string[]).includes(f.mimeType)) {
        throw new ScanError('invalid_mime', `Unsupported mime type: ${f.mimeType}`);
      }
      if (f.buffer.byteLength > SCAN_MAX_FILE_SIZE) {
        throw new ScanError('too_large', `File exceeds ${SCAN_MAX_FILE_SIZE} bytes`);
      }
    }

    const created = await scans.uploadScanSet({
      actorUserId: user.id,
      companyId,
      caption,
      files,
      ...(contractKindParsed?.success && contractId
        ? { contract: { kind: contractKindParsed.data, id: contractId } }
        : {}),
    });

    await writeAudit({
      actorUserId: user.id,
      action: 'scan.upload',
      entityType: 'scan_set',
      entityId: created.id,
      payload: {
        companyId: created.companyId,
        pages: created.pages.length,
        contract: created.contract,
      },
    });

    return c.json(scans.toScanSetDto(created), 201);
  } catch (err) {
    return handleScanError(c, err);
  }
});

scansRoutes.openapi(listDefaultScanSetsRoute, async (c) => {
  const { companyId, sets } = await scans.listSystemScanSets();
  return c.json({ companyId: companyId || null, sets: sets.map(scans.toScanSetDto) }, 200);
});

scansRoutes.openapi(listCompanyScanSetsRoute, async (c) => {
  const { companyId } = c.req.valid('param');
  const user = c.get('user');
  const isSystem = await scans.isSystemCompany(companyId);
  // Читать список компании — те же права, что читать любой её сет.
  // Для системной — любой авторизованный. Иначе — admin/info/head-владелец
  // или любой emp, если у него есть контракт в этой компании (проверится на per-set).
  if (!isSystem) {
    const allowedManage = await canManageScanSetForCompany(user, companyId, false);
    if (!allowedManage && user.role !== 'info') {
      // Игрок может видеть только сеты своих контрактов — обработаем ниже фильтрацией.
      if (user.role !== 'emp') {
        return apiError(c, 403, { code: 'forbidden', message: 'Insufficient role' });
      }
    }
  }
  const sets = await scans.listCompanyScanSets(companyId);
  const visible: typeof sets = [];
  for (const set of sets) {
    const can = await canReadScanSet(user, { ...set, isSystemCompany: isSystem });
    if (can) visible.push(set);
  }
  return c.json(visible.map(scans.toScanSetDto), 200);
});

scansRoutes.openapi(getScanSetRoute, async (c) => {
  const { setId } = c.req.valid('param');
  const user = c.get('user');
  try {
    const { set, isSystemCompany } = await scans.getScanSetOwnerContext(setId);
    const allowed = await canReadScanSet(user, { ...set, isSystemCompany });
    if (!allowed) return apiError(c, 403, { code: 'forbidden', message: 'Not allowed' });
    return c.json(scans.toScanSetDto(set), 200);
  } catch (err) {
    return handleScanError(c, err);
  }
});

scansRoutes.openapi(getScanPageRoute, async (c) => {
  const { pageId } = c.req.valid('param');
  const user = c.get('user');
  try {
    const page = await scans.getScanPage(pageId);
    const { set, isSystemCompany } = await scans.getScanSetOwnerContext(page.setId);
    const allowed = await canReadScanSet(user, { ...set, isSystemCompany });
    if (!allowed) return apiError(c, 403, { code: 'forbidden', message: 'Not allowed' });

    const { stream, sizeBytes } = await getScansStorage().read(page.filePath);
    c.header('Content-Type', page.mimeType);
    c.header('Content-Length', String(sizeBytes));
    c.header('Content-Disposition', 'inline');
    c.header('Cache-Control', 'private, max-age=60');
    return c.body(Readable.toWeb(stream) as ReadableStream);
  } catch (err) {
    return handleScanError(c, err);
  }
});

scansRoutes.openapi(deleteScanSetRoute, async (c) => {
  const { setId } = c.req.valid('param');
  const user = c.get('user');
  try {
    const { set, isSystemCompany } = await scans.getScanSetOwnerContext(setId);
    const allowed = await canManageScanSetForCompany(user, set.companyId, isSystemCompany);
    if (!allowed) return apiError(c, 403, { code: 'forbidden', message: 'Cannot delete' });

    await scans.deleteScanSet(setId);
    await writeAudit({
      actorUserId: user.id,
      action: 'scan.delete',
      entityType: 'scan_set',
      entityId: setId,
      payload: { companyId: set.companyId, pages: set.pages.length },
    });
    return c.body(null, 204);
  } catch (err) {
    return handleScanError(c, err);
  }
});
