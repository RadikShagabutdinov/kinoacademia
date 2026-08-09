import type { QueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router';

type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootComponent() {
  return <Outlet />;
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Страница не найдена</h1>
      <p className="text-[var(--color-muted-fg)]">
        Похоже, такого раздела нет. Вернитесь на главную.
      </p>
      <Link
        to="/"
        className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)]"
      >
        На главную
      </Link>
    </main>
  );
}

function RouteError({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Что-то пошло не так</h1>
      <p className="text-[var(--color-muted-fg)]">{error.message}</p>
    </main>
  );
}
