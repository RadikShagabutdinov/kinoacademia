import { EventEmitter } from 'node:events';

export type RatingUpdated =
  | { kind: 'person'; personId: string }
  | { kind: 'company'; companyId: string };

type RatingsEvents = {
  'rating.updated': [RatingUpdated];
};

export const ratingsEmitter = new EventEmitter<RatingsEvents>();
