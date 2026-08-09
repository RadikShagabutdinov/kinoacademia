export type RatingErrorCode =
  | 'self_transfer'
  | 'insufficient_generated'
  | 'invalid_amount'
  | 'not_implemented'
  | 'person_not_found'
  | 'company_not_found'
  | 'duplicate_randomizer_target';

export class RatingError extends Error {
  readonly code: RatingErrorCode;
  constructor(code: RatingErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'RatingError';
  }
}

export const ratingErrorStatus = (code: RatingErrorCode): 400 | 404 | 409 | 501 => {
  switch (code) {
    case 'person_not_found':
    case 'company_not_found':
      return 404;
    case 'not_implemented':
      return 501;
    case 'self_transfer':
    case 'insufficient_generated':
    case 'duplicate_randomizer_target':
      return 409;
    default:
      return 400;
  }
};
