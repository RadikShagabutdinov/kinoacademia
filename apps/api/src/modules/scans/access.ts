import type { RoleCode } from '@kinoacademia/shared';
import { ownsCompany, ownsPerson } from '../../auth/ownership';
import { db } from '../../db/client';
import type { ScanSetWithPagesRow } from './scans-repo';
import { findContractPersonAndCompany } from './scans-repo';

export type ScanActor = { id: string; role: RoleCode };

/**
 * Кто может **читать** сет:
 * - системный сет (default) — любой авторизованный;
 * - обычный сет — admin/info, head-владелец компании,
 *   владелец персонажа, если сет привязан к его контракту.
 */
export const canReadScanSet = async (
  actor: ScanActor,
  set: Pick<ScanSetWithPagesRow, 'companyId' | 'contract'> & { isSystemCompany: boolean },
): Promise<boolean> => {
  if (set.isSystemCompany) return true;
  if (actor.role === 'admin' || actor.role === 'info') return true;
  if (actor.role === 'head') {
    return await ownsCompany(db, actor.id, set.companyId);
  }
  if (actor.role === 'emp' && set.contract) {
    const contract = await findContractPersonAndCompany(db, set.contract.kind, set.contract.id);
    if (!contract) return false;
    return await ownsPerson(db, actor.id, contract.personId);
  }
  return false;
};

/**
 * Кто может **загружать / удалять** сет:
 * - системная компания — только admin/info;
 * - обычная компания — admin или head-владелец.
 */
export const canManageScanSetForCompany = async (
  actor: ScanActor,
  companyId: string,
  isSystemCompany: boolean,
): Promise<boolean> => {
  if (isSystemCompany) {
    return actor.role === 'admin' || actor.role === 'info';
  }
  if (actor.role === 'admin') return true;
  if (actor.role === 'head') {
    return await ownsCompany(db, actor.id, companyId);
  }
  return false;
};
