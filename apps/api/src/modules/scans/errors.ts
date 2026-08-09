import type { ScanErrorCode } from '@kinoacademia/shared';

export class ScanError extends Error {
  constructor(
    public readonly code: ScanErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ScanError';
  }
}

export const scanErrorStatus = (code: ScanErrorCode): 400 | 403 | 404 | 409 => {
  switch (code) {
    case 'not_found':
      return 404;
    case 'forbidden':
      return 403;
    case 'invalid_mime':
    case 'too_large':
    case 'too_many_pages':
    case 'no_files':
      return 400;
    case 'company_mismatch':
      return 409;
  }
};
