import { LoginForm } from '@/components/auth/LoginForm';
import { meQueryOptions } from '@/hooks/useMe';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const me = context.queryClient.getQueryData(meQueryOptions.queryKey);
    if (me) {
      throw redirect({ to: search.redirect ?? '/' });
    }
    try {
      await context.queryClient.fetchQuery(meQueryOptions);
      throw redirect({ to: search.redirect ?? '/' });
    } catch (err) {
      if ((err as { status?: number }).status === 401) return;
      if (err instanceof Error && 'href' in err) throw err;
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="accent-glow relative flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="relative z-[1] mx-auto w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-[34px] font-black leading-[1.05] tracking-tight">
          Спасибо
          <br />
          Киноакадемии!
        </h1>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--color-muted-fg)]">
          Логин и пароль выдаёт мастер игры. После первого входа пароль лучше сменить — на полигоне
          всякое бывает.
        </p>

        <div className="mt-8">
          <LoginForm />
        </div>

        <p className="mt-6 text-[11.5px] text-[var(--color-subtle-fg)]">
          Забыли пароль? Найдите мастера игры.
        </p>
        <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-subtle-fg)]">
          Полигон · 40–50 участников
        </p>
      </div>
    </main>
  );
}
