import type {
  ContractDto,
  ContractKind,
  ContractSide,
  ContractStatusCode,
  ContractStatusHistoryDto,
} from '@kinoacademia/shared';
import { db } from '../../db/client';
import * as repo from './contracts-repo';
import type { ContractRow, DbExecutor } from './contracts-repo';
import { ContractError } from './errors';
import { type ContractUpdated, contractsEmitter } from './events';
import { assertTransition } from './state-machine';

const emitUpdated = (events: ContractUpdated[]): void => {
  for (const evt of events) contractsEmitter.emit('contract.updated', evt);
};

export type PenaltyReason = 'unilateral_break_by_person' | 'auto_break_old_permanent';

/**
 * Размер штрафа считает модуль рейтингов: он зависит от постоянного рейтинга
 * персонажа и его статуса Звезды, а этими данными владеет ratings.service.
 */
export type PenaltyPayload = {
  personId: string;
  companyId: string;
  reason: PenaltyReason;
};

export type PenaltyHook = (payload: PenaltyPayload, exec: DbExecutor) => Promise<void>;

let penaltyHook: PenaltyHook | null = null;

/**
 * Регистрирует обработчик штрафа за односторонний разрыв permanent-контракта.
 * Реальную логику начисления подключает модуль рейтингов.
 */
export const setPenaltyHook = (hook: PenaltyHook | null): void => {
  penaltyHook = hook;
};

const callPenalty = async (payload: PenaltyPayload, exec: DbExecutor): Promise<void> => {
  if (penaltyHook) await penaltyHook(payload, exec);
};

/**
 * Пока действует постоянный контракт, постоянный рейтинг сотрудника учитывается
 * и у компании: при подтверждении зеркало создаётся, при завершении — снимается.
 * Саму арифметику делает модуль рейтингов.
 */
export type PermanentMirrorPayload = { personId: string; companyId: string };
export type PermanentMirrorHook = (
  payload: PermanentMirrorPayload,
  exec: DbExecutor,
) => Promise<void>;

let mirrorHooks: { attach: PermanentMirrorHook; detach: PermanentMirrorHook } | null = null;

export const setPermanentMirrorHooks = (
  hooks: { attach: PermanentMirrorHook; detach: PermanentMirrorHook } | null,
): void => {
  mirrorHooks = hooks;
};

const attachMirror = async (contract: ContractRow, exec: DbExecutor): Promise<void> => {
  if (contract.kind !== 'permanent' || !mirrorHooks) return;
  await mirrorHooks.attach({ personId: contract.personId, companyId: contract.companyId }, exec);
};

/**
 * Зеркало существует только у подтверждённого и ещё не завершённого постоянного
 * контракта: `startedAt` проставляется единственный раз — при подтверждении.
 * Вызывается до начисления штрафа, чтобы обе величины считались от одного и того
 * же, доштрафного рейтинга сотрудника.
 */
const detachMirrorIfPresent = async (contract: ContractRow, exec: DbExecutor): Promise<void> => {
  if (contract.kind !== 'permanent' || !contract.startedAt || contract.endedAt) return;
  if (!mirrorHooks) return;
  await mirrorHooks.detach({ personId: contract.personId, companyId: contract.companyId }, exec);
};

const loadContract = async (
  exec: DbExecutor,
  kind: ContractKind,
  id: string,
): Promise<ContractRow> => {
  const row = await repo.findContract(exec, kind, id);
  if (!row) throw new ContractError('contract_not_found', 'Contract not found');
  return row;
};

const transitionInternal = async (
  exec: DbExecutor,
  contract: ContractRow,
  toStatus: ContractStatusCode,
  actorUserId: string | null,
  comment: string | undefined,
  patch: {
    startedAt?: Date | null;
    endedAt?: Date | null;
    breakupInitiatedBy?: ContractSide | null;
  } = {},
  events?: ContractUpdated[],
): Promise<ContractRow> => {
  assertTransition(contract.statusCode, toStatus);
  const updated = await repo.updateContractStatus(exec, contract.kind, contract.id, {
    statusCode: toStatus,
    ...patch,
  });
  if (!updated) {
    throw new ContractError('contract_not_found', 'Contract disappeared during update');
  }
  await repo.insertHistory(exec, {
    contractId: contract.id,
    contractKind: contract.kind,
    fromStatusCode: contract.statusCode,
    toStatusCode: toStatus,
    changedByUserId: actorUserId,
    comment: comment ?? null,
  });
  events?.push({
    contractId: contract.id,
    kind: contract.kind,
    personId: contract.personId,
    companyId: contract.companyId,
    fromStatus: contract.statusCode,
    toStatus,
  });
  return updated;
};

export type CreateDraftInput = {
  kind: ContractKind;
  personId: string;
  companyId: string;
  actorUserId: string;
};

export const createDraft = async (input: CreateDraftInput): Promise<ContractRow> => {
  const { kind, personId, companyId, actorUserId } = input;
  const result = await db.transaction(async (tx) => {
    if (kind === 'permanent') {
      const existing = await repo.findActivePermanentByPersonCompany(tx, personId, companyId);
      if (existing) {
        throw new ContractError(
          'permanent_exists_same_company',
          'Active permanent contract with this company already exists',
        );
      }
    } else {
      const existing = await repo.findActiveTemporary(tx, personId, companyId);
      if (existing) {
        throw new ContractError(
          'duplicate_temporary',
          'Active temporary contract with this company already exists',
        );
      }
    }

    const contract = await repo.insertContract(tx, kind, {
      personId,
      companyId,
      statusCode: 'draft',
    });
    await repo.insertHistory(tx, {
      contractId: contract.id,
      contractKind: kind,
      fromStatusCode: null,
      toStatusCode: 'draft',
      changedByUserId: actorUserId,
    });
    return contract;
  });
  contractsEmitter.emit('contract.updated', {
    contractId: result.id,
    kind: result.kind,
    personId: result.personId,
    companyId: result.companyId,
    fromStatus: null,
    toStatus: 'draft',
  });
  return result;
};

export type ActionInput = {
  kind: ContractKind;
  id: string;
  actorUserId: string;
  comment?: string;
  /** Сторона, от лица которой выполняется действие. Заполняется роутом. */
  side?: ContractSide;
};

const runWithEvents = async <T>(
  fn: (tx: DbExecutor, events: ContractUpdated[]) => Promise<T>,
): Promise<T> => {
  const events: ContractUpdated[] = [];
  const result = await db.transaction((tx) => fn(tx, events));
  emitUpdated(events);
  return result;
};

export const submit = ({ kind, id, actorUserId, comment }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    return transitionInternal(tx, contract, 'sent', actorUserId, comment, {}, events);
  });

export const reject = ({ kind, id, actorUserId, comment }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    return transitionInternal(
      tx,
      contract,
      'rejected',
      actorUserId,
      comment,
      { endedAt: new Date() },
      events,
    );
  });

export const breakByCompany = ({ kind, id, actorUserId, comment }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    await detachMirrorIfPresent(contract, tx);
    return transitionInternal(
      tx,
      contract,
      'broken_company',
      actorUserId,
      comment,
      { endedAt: new Date() },
      events,
    );
  });

export const requestEnd = ({ kind, id, actorUserId, comment, side }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    return transitionInternal(
      tx,
      contract,
      'breakup_sent',
      actorUserId,
      comment,
      { breakupInitiatedBy: side ?? null },
      events,
    );
  });

/**
 * Запрос на расторжение подтверждает или отклоняет только противоположная
 * сторона — иначе инициатор закрыл бы контракт сам, минуя обоюдное согласие.
 */
const assertRespondingSide = (contract: ContractRow, side: ContractSide | undefined): void => {
  if (!side || !contract.breakupInitiatedBy) return;
  if (contract.breakupInitiatedBy === side) {
    throw new ContractError('forbidden', 'Breakup request must be answered by the other party');
  }
};

export const confirmEnd = ({ kind, id, actorUserId, comment, side }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    assertRespondingSide(contract, side);
    await detachMirrorIfPresent(contract, tx);
    return transitionInternal(
      tx,
      contract,
      'breakup_confirmed',
      actorUserId,
      comment,
      { endedAt: new Date() },
      events,
    );
  });

export const rejectEnd = ({ kind, id, actorUserId, comment, side }: ActionInput) =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    assertRespondingSide(contract, side);
    return transitionInternal(tx, contract, 'breakup_rejected', actorUserId, comment, {}, events);
  });

export const confirm = ({ kind, id, actorUserId, comment }: ActionInput): Promise<ContractRow> =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    const now = new Date();

    if (kind === 'permanent') {
      const oldPermanent = await repo.findEffectivePermanentByPerson(tx, contract.personId);
      if (oldPermanent && oldPermanent.id !== contract.id) {
        await detachMirrorIfPresent(oldPermanent, tx);
        await transitionInternal(
          tx,
          oldPermanent,
          'broken_person',
          actorUserId,
          'Auto-break: new permanent confirmed',
          { endedAt: now },
          events,
        );
        await callPenalty(
          {
            personId: oldPermanent.personId,
            companyId: oldPermanent.companyId,
            reason: 'auto_break_old_permanent',
          },
          tx,
        );
      }

      const tempSameCompany = await repo.findEffectiveTemporary(
        tx,
        contract.personId,
        contract.companyId,
      );
      if (tempSameCompany) {
        // По правилам игры такой временный контракт расторгается по обоюдному
        // согласию, поэтому проводим его через breakup_sent, а не односторонним
        // разрывом: иначе в истории и аналитике он выглядит как разрыв компанией.
        const requested = await transitionInternal(
          tx,
          tempSameCompany,
          'breakup_sent',
          actorUserId,
          'Auto-break: permanent with same company confirmed',
          {},
          events,
        );
        await transitionInternal(
          tx,
          requested,
          'breakup_confirmed',
          actorUserId,
          'Auto-break: permanent with same company confirmed',
          { endedAt: now },
          events,
        );
      }
    }

    const confirmed = await transitionInternal(
      tx,
      contract,
      'confirmed',
      actorUserId,
      comment,
      { startedAt: now },
      events,
    );
    await attachMirror(confirmed, tx);
    return confirmed;
  });

export const breakByPerson = ({
  kind,
  id,
  actorUserId,
  comment,
}: ActionInput): Promise<ContractRow> =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, kind, id);
    const now = new Date();
    await detachMirrorIfPresent(contract, tx);
    const updated = await transitionInternal(
      tx,
      contract,
      'broken_person',
      actorUserId,
      comment,
      { endedAt: now },
      events,
    );
    if (kind === 'permanent') {
      await callPenalty(
        {
          personId: contract.personId,
          companyId: contract.companyId,
          reason: 'unilateral_break_by_person',
        },
        tx,
      );
    }
    return updated;
  });

export type ForceBreakInput = {
  kind: ContractKind;
  id: string;
  side: 'company' | 'person';
  actorUserId: string;
  applyPenalty?: boolean;
  comment?: string;
};

const FORCE_BREAKABLE: ContractStatusCode[] = [
  'draft',
  'sent',
  'confirmed',
  'breakup_sent',
  'breakup_rejected',
];

export const forceBreakByAdmin = (input: ForceBreakInput): Promise<ContractRow> =>
  runWithEvents(async (tx, events) => {
    const contract = await loadContract(tx, input.kind, input.id);

    if (contract.endedAt) {
      throw new ContractError('contract_already_ended', 'Contract is already ended');
    }
    if (!FORCE_BREAKABLE.includes(contract.statusCode)) {
      throw new ContractError(
        'invalid_force_break',
        `Cannot force-break contract in status ${contract.statusCode}`,
      );
    }

    const toStatus: ContractStatusCode =
      input.side === 'company' ? 'broken_company' : 'broken_person';
    const now = new Date();
    await detachMirrorIfPresent(contract, tx);
    const updated = await repo.updateContractStatus(tx, contract.kind, contract.id, {
      statusCode: toStatus,
      endedAt: now,
    });
    if (!updated) {
      throw new ContractError('contract_not_found', 'Contract disappeared during update');
    }

    await repo.insertHistory(tx, {
      contractId: contract.id,
      contractKind: contract.kind,
      fromStatusCode: contract.statusCode,
      toStatusCode: toStatus,
      changedByUserId: input.actorUserId,
      comment: input.comment ?? 'Admin force break',
    });

    events.push({
      contractId: contract.id,
      kind: contract.kind,
      personId: contract.personId,
      companyId: contract.companyId,
      fromStatus: contract.statusCode,
      toStatus,
    });

    if (input.applyPenalty !== false && input.kind === 'permanent' && input.side === 'person') {
      await callPenalty(
        {
          personId: contract.personId,
          companyId: contract.companyId,
          reason: 'unilateral_break_by_person',
        },
        tx,
      );
    }

    return updated;
  });

export const listActiveContracts = (): Promise<ContractRow[]> => repo.listActiveContracts(db);

export const findContract = (kind: ContractKind, id: string): Promise<ContractRow | null> =>
  repo.findContract(db, kind, id);

export const listMyContracts = (personId: string): Promise<ContractRow[]> =>
  repo.listContractsByPerson(db, personId);

export const listCompanyContracts = (companyId: string): Promise<ContractRow[]> =>
  repo.listContractsByCompany(db, companyId);

export const listStatusHistory = (
  filter: repo.ListStatusHistoryFilter = {},
): Promise<repo.ContractHistoryRow[]> => repo.listStatusHistory(db, filter);

export const toHistoryDto = (row: repo.ContractHistoryRow): ContractStatusHistoryDto => ({
  id: row.id,
  contractId: row.contractId,
  contractKind: row.contractKind,
  fromStatusCode: row.fromStatusCode,
  toStatusCode: row.toStatusCode,
  changedAt: row.changedAt.toISOString(),
  changedByUserId: row.changedByUserId,
  comment: row.comment,
  companyId: row.companyId,
  companyName: row.companyName,
  branchCode: row.branchCode,
  personId: row.personId,
  personDisplayName: row.personDisplayName,
});

export const toContractDto = (row: ContractRow): ContractDto => ({
  id: row.id,
  kind: row.kind,
  personId: row.personId,
  companyId: row.companyId,
  statusCode: row.statusCode,
  startedAt: row.startedAt?.toISOString() ?? null,
  endedAt: row.endedAt?.toISOString() ?? null,
  breakupInitiatedBy: row.breakupInitiatedBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
