export type FilmErrorCode =
  | 'film_not_found'
  | 'company_not_found'
  | 'not_cinema'
  | 'person_not_found'
  | 'duplicate_assignment'
  | 'assignment_not_found'
  | 'assignment_nominated';

export class FilmError extends Error {
  constructor(
    public readonly code: FilmErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'FilmError';
  }
}

export const filmErrorStatus = (code: FilmErrorCode): 404 | 409 => {
  switch (code) {
    case 'film_not_found':
    case 'company_not_found':
    case 'person_not_found':
    case 'assignment_not_found':
      return 404;
    case 'not_cinema':
    case 'duplicate_assignment':
    case 'assignment_nominated':
      return 409;
  }
};
