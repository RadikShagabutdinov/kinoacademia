import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PERSON_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const COMPANY_ID = '9f1e5b2c-3d4a-4f6b-8c7d-1e2f3a4b5c6d';

const mocks = vi.hoisted(() => ({
  listAdminPersons: vi.fn(),
  listAdminCompanies: vi.fn(),
  getAdminAllRatings: vi.fn(),
  createManualTransaction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/api/admin/persons', () => ({ listAdminPersons: mocks.listAdminPersons }));
vi.mock('@/api/admin/companies', () => ({ listAdminCompanies: mocks.listAdminCompanies }));
vi.mock('@/api/admin/ratings', () => ({ getAdminAllRatings: mocks.getAdminAllRatings }));
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

/** Открывает Radix-селект по подписи и выбирает пункт с указанным текстом. */
const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  labelText: RegExp,
  optionText: RegExp,
) => {
  await user.click(screen.getByLabelText(labelText));
  await user.click(await screen.findByRole('option', { name: optionText }));
};

describe('ManualTxForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAdminPersons.mockResolvedValue([{ id: PERSON_ID, displayName: 'Виаго' }]);
    mocks.listAdminCompanies.mockResolvedValue([{ id: COMPANY_ID, name: 'Кинокомпания А' }]);
    mocks.getAdminAllRatings.mockResolvedValue({
      persons: [{ personId: PERSON_ID, generated: 5, nowPermanent: 50 }],
      companies: [{ companyId: COMPANY_ID, budget: 400, nowPermanent: 300 }],
      personNames: {},
      companyNames: {},
    });
    mocks.createManualTransaction.mockResolvedValue({});
  });

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

  it('блокирует отправку без выбранного получателя', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/значение/i), '100');
    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));

    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createManualTransaction).not.toHaveBeenCalled();
  });

  it('отправляет начисление из админского ресурса без источника', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseOption(user, /получатель/i, /виаго/i);
    await user.type(screen.getByLabelText(/значение/i), '100');
    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));

    // TanStack Query добавляет вторым аргументом контекст мутации — сверяем payload.
    expect(mocks.createManualTransaction.mock.calls[0]?.[0]).toEqual({
      to: { personId: PERSON_ID, slot: 'permanent', kind: 'manual' },
      amount: 100,
      mode: 'absolute',
    });
  });

  it('отправляет перевод от компании с указанием части рейтинга', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseOption(user, /источник/i, /компания/i);
    await chooseOption(user, /^компания$/i, /кинокомпания а/i);
    await chooseOption(user, /получатель/i, /виаго/i);
    await user.type(screen.getByLabelText(/значение/i), '100');
    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));

    expect(mocks.createManualTransaction.mock.calls[0]?.[0]).toEqual({
      to: { personId: PERSON_ID, slot: 'permanent', kind: 'manual' },
      from: { companyId: COMPANY_ID, slot: 'permanent' },
      amount: 100,
      mode: 'absolute',
    });
  });

  it('разрешает переменный рейтинг получателя только из админского ресурса', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^часть рейтинга$/i));
    expect(await screen.findByRole('option', { name: /переменный рейтинг/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');

    await chooseOption(user, /источник/i, /компания/i);
    await user.click(screen.getAllByLabelText(/^часть рейтинга$/i)[1] as HTMLElement);
    expect(await screen.findByRole('option', { name: /переменный рейтинг/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('разрешает процент только с постоянного счёта компании', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText(/^режим$/i));
    expect(await screen.findByRole('option', { name: /процент/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');

    await chooseOption(user, /источник/i, /компания/i);
    await user.click(screen.getByLabelText(/^режим$/i));
    expect(await screen.findByRole('option', { name: /процент/i })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('показывает абсолютную величину процентного перевода', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseOption(user, /источник/i, /компания/i);
    await chooseOption(user, /^компания$/i, /кинокомпания а/i);
    await chooseOption(user, /получатель/i, /виаго/i);
    await chooseOption(user, /^режим$/i, /процент/i);
    await user.type(screen.getByLabelText(/значение/i), '25');

    // 25% от постоянного рейтинга компании (300).
    expect(await screen.findByText(/это/i)).toHaveTextContent('75');

    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));
    expect(mocks.createManualTransaction.mock.calls[0]?.[0]).toEqual({
      to: { personId: PERSON_ID, slot: 'permanent', kind: 'manual' },
      from: { companyId: COMPANY_ID, slot: 'permanent' },
      amount: 25,
      mode: 'percent',
    });
  });

  it('не даёт увести источник в минус', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseOption(user, /источник/i, /компания/i);
    await chooseOption(user, /^компания$/i, /кинокомпания а/i);
    await chooseOption(user, /получатель/i, /виаго/i);
    await user.type(screen.getByLabelText(/значение/i), '500');

    expect(await screen.findByText(/доступно у источника: 300/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /создать транзакцию/i }));
    expect(mocks.toastError).toHaveBeenCalled();
    expect(mocks.createManualTransaction).not.toHaveBeenCalled();
  });
});
