export type OscarErrorCode =
  | 'oscar_not_found'
  | 'film_not_found'
  | 'person_not_found'
  | 'company_not_found'
  | 'not_cinema'
  | 'closed_nomination'
  | 'invalid_role_for_nomination'
  | 'person_not_in_film'
  | 'film_not_in_company'
  | 'already_awarded'
  | 'requires_film'
  | 'requires_person'
  | 'insufficient_budget';

export class OscarError extends Error {
  constructor(
    public readonly code: OscarErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'OscarError';
  }
}

export const oscarErrorStatus = (code: OscarErrorCode): 400 | 404 | 409 => {
  switch (code) {
    case 'oscar_not_found':
    case 'film_not_found':
    case 'person_not_found':
    case 'company_not_found':
      return 404;
    case 'requires_film':
    case 'requires_person':
      return 400;
    case 'not_cinema':
    case 'closed_nomination':
    case 'invalid_role_for_nomination':
    case 'person_not_in_film':
    case 'film_not_in_company':
    case 'already_awarded':
    case 'insufficient_budget':
      return 409;
  }
};
