import { CAPITALIZATION_PER_EMPLOYEE_CAP } from '@kinoacademia/shared';
import { describe, expect, it } from 'vitest';
import { employeeCapitalization } from './capitalizeCompanies';

describe('employeeCapitalization', () => {
  it('без модификатора вся сумма — обычная капитализация', () => {
    expect(employeeCapitalization(40, 0)).toEqual({ amount: 40, randomizerShare: 0 });
  });

  it('модификатор выделяется в отдельную долю', () => {
    expect(employeeCapitalization(70, 20)).toEqual({ amount: 70, randomizerShare: 20 });
  });

  it('потолок режет и сумму, и долю модификатора', () => {
    // 120 → 100 с модификатором, 90 → 90 без него: доля модификатора всего 10.
    expect(employeeCapitalization(120, 30)).toEqual({
      amount: CAPITALIZATION_PER_EMPLOYEE_CAP,
      randomizerShare: 10,
    });
  });

  it('отрицательный модификатор даёт отрицательную долю', () => {
    expect(employeeCapitalization(60, -30)).toEqual({ amount: 60, randomizerShare: -30 });
  });

  it('нулевая прибавка при отрицательной базе всё равно несёт долю модификатора', () => {
    expect(employeeCapitalization(0, 20)).toEqual({ amount: 0, randomizerShare: 20 });
  });
});
