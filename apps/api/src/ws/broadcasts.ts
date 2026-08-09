import { contractsEmitter } from '../modules/contracts/events';
import { oscarsEmitter } from '../modules/oscars/events';
import { findPersonById } from '../modules/persons/persons-repo';
import { ratingsEmitter } from '../modules/ratings/events';
import { companyChannel, personChannel } from './channels';
import * as hub from './hub';

let wired = false;

/**
 * Подписывает WS-хаб на доменные эмиттеры. Вызывается один раз при старте API.
 */
export const wireWsBroadcasts = (): void => {
  if (wired) return;
  wired = true;
  attachListeners();
};

const attachListeners = (): void => {
  ratingsEmitter.on('rating.updated', (evt) => {
    if (evt.kind === 'person') {
      const payload = { personId: evt.personId };
      hub.broadcast(personChannel(evt.personId), 'rating.updated', payload);
      hub.broadcast('ratings:all', 'rating.updated', { kind: 'person', ...payload });
    } else {
      const payload = { companyId: evt.companyId };
      hub.broadcast(companyChannel(evt.companyId), 'rating.updated', payload);
      hub.broadcast('ratings:all', 'rating.updated', { kind: 'company', ...payload });
    }
  });

  contractsEmitter.on('contract.updated', async (evt) => {
    const payload = {
      contractId: evt.contractId,
      kind: evt.kind,
      personId: evt.personId,
      companyId: evt.companyId,
      fromStatus: evt.fromStatus,
      toStatus: evt.toStatus,
    };
    hub.broadcast(companyChannel(evt.companyId), 'contract.updated', payload);

    const person = await findPersonById(evt.personId).catch(() => null);
    if (person?.userId) {
      hub.broadcastToUser(person.userId, 'contracts:my', 'contract.updated', payload);
    }
  });

  oscarsEmitter.on('oscar.nominated', (evt) => {
    hub.broadcast('oscars', 'oscar.nominated', evt);
  });

  oscarsEmitter.on('oscar.awarded', (evt) => {
    hub.broadcast('oscars', 'oscar.awarded', evt);
  });
};

export const _resetForTests = (): void => {
  ratingsEmitter.removeAllListeners();
  contractsEmitter.removeAllListeners();
  oscarsEmitter.removeAllListeners();
  attachListeners();
};
