import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

type HealthReady = {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
  jobs: boolean;
  version: string;
};

type Probe = {
  health: HealthReady;
  latencyMs: number;
};

/**
 * Публичная страница состояния сервера: без авторизации и без обращений
 * к защищённым эндпоинтам — чтобы во время игры можно было проверить,
 * жив ли бэкенд, не имея доступа в админку.
 */
export const Route = createFileRoute('/status')({
  component: StatusPage,
});

const probe = async (): Promise<Probe> => {
  const startedAt = performance.now();
  const res = await fetch('/health/ready', { cache: 'no-store' });
  const latencyMs = Math.round(performance.now() - startedAt);
  return { health: (await res.json()) as HealthReady, latencyMs };
};

function StatusPage() {
  const { data, isError, isPending, dataUpdatedAt } = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: probe,
    refetchInterval: 15_000,
    retry: false,
  });

  const online = !isError && data?.health.status === 'ok';

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-black tracking-tight">
          Состояние сервера
        </h1>

        <div className="mt-6 flex items-center gap-3">
          <span
            aria-hidden
            className={`inline-block size-3 rounded-full ${
              isPending ? 'bg-[var(--color-subtle-fg)]' : online ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className="text-[15px] font-semibold">
            {isPending ? 'Проверяем…' : online ? 'Работает' : 'Недоступен'}
          </span>
        </div>

        <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[12.5px]">
          <Row label="База данных" value={statusLabel(data?.health.db)} />
          <Row label="Плановые задачи" value={jobsLabel(data?.health.jobs)} />
          <Row label="Версия" value={data?.health.version ?? '—'} />
          <Row label="Ответ" value={data ? `${data.latencyMs} мс` : '—'} />
          <Row
            label="Проверено"
            value={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ru-RU') : '—'}
          />
        </dl>

        <p className="mt-10 text-[11px] text-[var(--color-subtle-fg)]">
          Страница обновляется автоматически раз в 15 секунд.
        </p>
      </div>
    </main>
  );
}

const statusLabel = (value: HealthReady['db'] | undefined) => {
  if (value === 'ok') return 'в порядке';
  if (value === 'error') return 'недоступна';
  return '—';
};

const jobsLabel = (value: boolean | undefined) => {
  if (value === undefined) return '—';
  return value ? 'включены' : 'выключены';
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--color-muted-fg)]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </>
  );
}
