import { login as apiLogin, getMe } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginInput } from '@kinoacademia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type Resolver, useForm } from 'react-hook-form';

type FormValues = { login: string; password: string };

export const LoginForm = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' }) as { redirect?: string };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(LoginInput as never) as Resolver<FormValues>,
    defaultValues: { login: '', password: '' },
  });

  const { mutateAsync: doLogin } = useMutation({
    mutationFn: apiLogin,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await doLogin(values);
      const me = await getMe();
      queryClient.setQueryData(['auth', 'me'], me);
      navigate({ to: search.redirect ?? '/' });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const message =
        status === 401
          ? 'Неверный логин или пароль'
          : status === 429
            ? 'Слишком много попыток входа, попробуйте через минуту'
            : 'Не удалось войти. Попробуйте позже';
      setError('root', { message });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label
          htmlFor="login"
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-fg)]"
        >
          Логин
        </Label>
        <Input
          id="login"
          type="text"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.login)}
          {...register('login')}
        />
        {errors.login && (
          <p className="text-sm text-[var(--color-destructive)]">{errors.login.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="password"
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-fg)]"
        >
          Пароль
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-[var(--color-destructive)]">{errors.password.message}</p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" size="xl" disabled={isSubmitting}>
        {isSubmitting ? 'Входим…' : 'Войти'}
      </Button>
    </form>
  );
};
