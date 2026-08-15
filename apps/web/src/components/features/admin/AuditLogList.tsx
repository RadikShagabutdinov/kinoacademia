import { type AuditLogFilter, listAuditLog } from '@/api/admin/audit';
import { Badge } from '@/components/ui/badge';
import { NoticeBox } from '@/components/ui/notice-box';
import { Skeleton } from '@/components/ui/skeleton';
import { MonoValue, SectionLabel } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import type { AuditAction } from '@kinoacademia/shared';
import { useQuery } from '@tanstack/react-query';

const ACTION_LABELS: Record<AuditAction, string> = {
  'user.create': 'Создан пользователь',
  'user.update': 'Изменён пользователь',
  'user.reset_password': 'Сброшен пароль',
  'person.create': 'Создан персонаж',
  'person.update': 'Изменён персонаж',
  'person.open': 'Открыт персонаж',
  'person.close': 'Закрыт персонаж',
  'company.create': 'Создана компания',
  'company.update': 'Изменена компания',
  'transaction.manual': 'Ручная транзакция',
  'randomizer.apply': 'Применён рандомайзер',
  'randomizer.cancel': 'Отменён рандомайзер',
  'job.update': 'Изменена задача',
  'job.run_now': 'Ручной запуск задачи',
  'film.create': 'Создан фильм',
  'film.assignment.create': 'Добавлен участник фильма',
  'film.assignment.delete': 'Удалён участник фильма',
  'oscar.nominate': 'Подана номинация',
  'oscar.withdraw': 'Отозвана номинация',
  'oscar.award': 'Вручён Оскар',
  'scan.upload': 'Загружены сканы',
  'scan.delete': 'Удалены сканы',
};

type Props = {
  filter?: AuditLogFilter;
  title?: string;
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AuditLogList = ({ filter, title = 'Аудит' }: Props) => {
  const query = useQuery({
    queryKey: ['admin', 'audit', filter ?? {}],
    queryFn: () => listAuditLog(filter ?? {}),
  });

  return (
    <section>
      <SectionLabel className="mb-2.5">{title}</SectionLabel>
      {query.isLoading ? (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      ) : query.data && query.data.length > 0 ? (
        <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {query.data.map((entry, idx) => (
            <li
              key={entry.id}
              className={cn(
                'flex flex-col gap-2 border-t border-[var(--color-hairline)] px-3.5 py-2.5 first:border-t-0',
                idx % 2 === 1 && 'bg-[var(--color-row-alt)]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                <MonoValue className="text-[10.5px] font-semibold text-[var(--color-subtle-fg)]">
                  {fmt(entry.createdAt)}
                </MonoValue>
              </div>
              {entry.payload && Object.keys(entry.payload).length > 0 ? (
                <pre className="font-[family-name:var(--font-mono)] overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--color-row-alt)] p-2 text-[10.5px] leading-relaxed text-[var(--color-muted-fg)]">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <NoticeBox tone="muted">Нет записей.</NoticeBox>
      )}
    </section>
  );
};
