import type {
  CreateFilmAssignmentInput,
  CreateFilmInput,
  FilmAssignmentDetailDto,
  FilmDto,
  FilmWithAssignmentsDto,
} from '@kinoacademia/shared';
import { api } from './client';

export type FilmListItem = FilmDto & { companyName: string };

export const listAllFilms = (): Promise<FilmListItem[]> => api.get<FilmListItem[]>('/films');

export const listCompanyFilms = (companyId: string): Promise<FilmListItem[]> =>
  api.get<FilmListItem[]>(`/films/company/${companyId}`);

export const getFilm = (id: string): Promise<FilmWithAssignmentsDto> =>
  api.get<FilmWithAssignmentsDto>(`/films/${id}`);

export const createFilm = (input: CreateFilmInput): Promise<FilmDto> =>
  api.post<FilmDto>('/films', input);

export const addAssignment = (
  filmId: string,
  input: CreateFilmAssignmentInput,
): Promise<FilmAssignmentDetailDto> =>
  api.post<FilmAssignmentDetailDto>(`/films/${filmId}/assignments`, input);
