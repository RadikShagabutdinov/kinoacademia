import { EventEmitter } from 'node:events';
import type { NominationCode } from '@kinoacademia/shared';

export type OscarEvent = {
  oscarId: string;
  filmId: string | null;
  personId: string | null;
  companyId: string | null;
  nominationCode: NominationCode;
  isWinner: boolean;
};

type OscarEvents = {
  'oscar.nominated': [OscarEvent];
  'oscar.awarded': [OscarEvent];
  'oscar.withdrawn': [OscarEvent];
};

export const oscarsEmitter = new EventEmitter<OscarEvents>();
