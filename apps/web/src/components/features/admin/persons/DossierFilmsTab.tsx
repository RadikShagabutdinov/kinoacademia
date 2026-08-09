import { listAllFilms } from '@/api/films';
import { listPersonOscars } from '@/api/oscars';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type Props = { personId: string };

export const DossierFilmsTab = ({ personId }: Props) => {
  // Список фильмов, в которых персонаж имеет участие, проще получить через
  // выборку всех номинаций (приходят с filmTitle и companyName) — этого
  // достаточно для досье. Для расширенного досье можно завести отдельный
  // эндпоинт фильмов по персоне.
  const oscarsQuery = useQuery({
    queryKey: ['oscars', 'person', personId],
    queryFn: () => listPersonOscars(personId),
  });

  const filmsQuery = useQuery({ queryKey: ['films', 'all'], queryFn: listAllFilms });

  const personFilms = useMemo(() => {
    if (!filmsQuery.data || !oscarsQuery.data) return [];
    const filmIds = new Set(
      oscarsQuery.data.map((o) => o.filmId).filter((id): id is string => Boolean(id)),
    );
    return filmsQuery.data.filter((f) => filmIds.has(f.id));
  }, [filmsQuery.data, oscarsQuery.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фильмы</CardTitle>
      </CardHeader>
      <CardContent>
        {oscarsQuery.isPending || filmsQuery.isPending ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Загрузка…</p>
        ) : personFilms.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-fg)]">
            Персонаж пока не участвовал в фильмах с номинациями.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Компания</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personFilms.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell>{f.companyName}</TableCell>
                  <TableCell>{new Date(f.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
