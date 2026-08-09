import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({ redirect: undefined }),
}));

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  getMe: vi.fn(),
}));

import { LoginForm } from './LoginForm';

const renderForm = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>,
  );
};

describe('LoginForm', () => {
  it('показывает ошибки валидации Zod', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      const loginField = screen.getByLabelText(/логин/i);
      expect(loginField).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('рендерит поля логин и пароль', () => {
    renderForm();
    expect(screen.getByLabelText(/логин/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
  });
});
