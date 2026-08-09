import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAdminPersons: vi.fn().mockResolvedValue([]),
  listAdminCompanies: vi.fn().mockResolvedValue([]),
  createManualTransaction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/api/admin/persons', () => ({ listAdminPersons: mocks.listAdminPersons }));
vi.mock('@/api/admin/companies', () => ({ listAdminCompanies: mocks.listAdminCompanies }));
vi.mock('@/api/admin/transactions', () => ({
  createManualTransaction: mocks.createManualTransaction,
}));
vi.mock('@/components/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError, info: mocks.toastInfo },
}));

import { ManualTxForm } from './ManualTxForm';

const renderForm = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ManualTxForm />
    </QueryClientProvider>,
  );
};

describe('ManualTxForm', () => {
  it('блокирует отправку при пустой сумме', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createManualTransaction).not.toHaveBeenCalled();
  });

  it('блокирует отправку при нулевой сумме', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/значение/i), '0');
    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createManualTransaction).not.toHaveBeenCalled();
  });
});
