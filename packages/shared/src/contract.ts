import { z } from '@hono/zod-openapi';
import { IsoDateTime, Uuid } from './common';

export const CONTRACT_KINDS = ['permanent', 'temporary'] as const;
export const ContractKind = z.enum(CONTRACT_KINDS);
export type ContractKind = z.infer<typeof ContractKind>;

export const CONTRACT_STATUSES = [
  'draft',
  'sent',
  'confirmed',
  'rejected',
  'breakup_sent',
  'breakup_confirmed',
  'breakup_rejected',
  'broken_company',
  'broken_person',
] as const;
export const ContractStatusCode = z.enum(CONTRACT_STATUSES);
export type ContractStatusCode = z.infer<typeof ContractStatusCode>;

export const CONTRACT_STATUS_LABELS: Record<ContractStatusCode, string> = {
  draft: 'Черновик',
  sent: 'Отправлен на подтверждение',
  confirmed: 'Подтверждён',
  rejected: 'Отклонён',
  breakup_sent: 'Отправлен на разрыв',
  breakup_confirmed: 'Разрыв подтверждён',
  breakup_rejected: 'Разрыв отклонён',
  broken_company: 'Односторонний разрыв компанией',
  broken_person: 'Односторонний разрыв персонажем',
};

/** Сторона контракта, действующая в переходе (инициатор расторжения). */
export const ContractSide = z.enum(['person', 'company']);
export type ContractSide = z.infer<typeof ContractSide>;

export const ContractDto = z.object({
  id: Uuid,
  kind: ContractKind,
  personId: Uuid,
  companyId: Uuid,
  statusCode: ContractStatusCode,
  startedAt: IsoDateTime.nullable(),
  endedAt: IsoDateTime.nullable(),
  breakupInitiatedBy: ContractSide.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ContractDto = z.infer<typeof ContractDto>;

export const CreateContractInput = z.object({
  kind: ContractKind,
  personId: Uuid,
  companyId: Uuid,
});
export type CreateContractInput = z.infer<typeof CreateContractInput>;

export const ChangeContractStatusInput = z.object({
  toStatusCode: ContractStatusCode,
  comment: z.string().max(1000).optional(),
});
export type ChangeContractStatusInput = z.infer<typeof ChangeContractStatusInput>;

export const ContractActionInput = z
  .object({
    comment: z.string().max(1000).optional(),
  })
  .strict();
export type ContractActionInput = z.infer<typeof ContractActionInput>;

export const ForceBreakSide = z.enum(['company', 'person']);
export type ForceBreakSide = z.infer<typeof ForceBreakSide>;

export const ForceBreakContractInput = z
  .object({
    side: ForceBreakSide,
    applyPenalty: z.boolean().optional().default(true),
    comment: z.string().max(1000).optional(),
  })
  .strict();
export type ForceBreakContractInput = z.infer<typeof ForceBreakContractInput>;

/**
 * Односторонний разрыв доступен из любого действующего статуса: и пока висит
 * запрос на расторжение, и после отказа в нём — иначе `breakup_rejected` делал
 * бы контракт неразрываемым.
 */
export const CONTRACT_TRANSITIONS: Record<ContractStatusCode, readonly ContractStatusCode[]> = {
  draft: ['sent'],
  sent: ['confirmed', 'rejected'],
  confirmed: ['broken_company', 'broken_person', 'breakup_sent'],
  rejected: [],
  breakup_sent: ['breakup_confirmed', 'breakup_rejected', 'broken_company', 'broken_person'],
  breakup_confirmed: [],
  breakup_rejected: ['breakup_sent', 'broken_company', 'broken_person'],
  broken_company: [],
  broken_person: [],
};

export const canTransition = (from: ContractStatusCode, to: ContractStatusCode): boolean =>
  CONTRACT_TRANSITIONS[from].includes(to);

export const ACTIVE_CONTRACT_STATUSES: readonly ContractStatusCode[] = [
  'draft',
  'sent',
  'confirmed',
  'breakup_sent',
  'breakup_rejected',
];

export const TERMINAL_CONTRACT_STATUSES: readonly ContractStatusCode[] = [
  'rejected',
  'broken_company',
  'broken_person',
  'breakup_confirmed',
];

export const ContractStatusHistoryDto = z.object({
  id: Uuid,
  contractId: Uuid,
  contractKind: ContractKind,
  fromStatusCode: ContractStatusCode.nullable(),
  toStatusCode: ContractStatusCode,
  changedAt: IsoDateTime,
  changedByUserId: Uuid.nullable(),
  comment: z.string().nullable(),
  companyId: Uuid,
  companyName: z.string(),
  personId: Uuid,
  personDisplayName: z.string(),
});
export type ContractStatusHistoryDto = z.infer<typeof ContractStatusHistoryDto>;

export const ContractsHistoryQuery = z
  .object({
    companyId: Uuid.optional(),
    personId: Uuid.optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  })
  .strict();
export type ContractsHistoryQuery = z.infer<typeof ContractsHistoryQuery>;

export const CONTRACT_ERROR_CODES = [
  'invalid_transition',
  'duplicate_temporary',
  'permanent_exists_same_company',
  'contract_not_found',
  'contract_already_ended',
  'invalid_force_break',
  'forbidden',
] as const;
export const ContractErrorCode = z.enum(CONTRACT_ERROR_CODES);
export type ContractErrorCode = z.infer<typeof ContractErrorCode>;
