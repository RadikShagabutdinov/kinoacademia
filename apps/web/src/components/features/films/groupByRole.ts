import type { FilmAssignmentDetailDto, FilmRole } from '@kinoacademia/shared';

/** Группирует назначения съёмочной группы по роли: на одну роль их может быть несколько. */
export const groupByRole = (
  assignments: FilmAssignmentDetailDto[],
): Map<FilmRole, FilmAssignmentDetailDto[]> => {
  const map = new Map<FilmRole, FilmAssignmentDetailDto[]>();
  for (const a of assignments) {
    const list = map.get(a.role);
    if (list) list.push(a);
    else map.set(a.role, [a]);
  }
  return map;
};
