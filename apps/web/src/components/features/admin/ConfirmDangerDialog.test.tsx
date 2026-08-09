import { Button } from '@/components/ui/button';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDangerDialog } from './ConfirmDangerDialog';

describe('ConfirmDangerDialog', () => {
  it('открывается по клику на триггер и вызывает onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ConfirmDangerDialog
        trigger={<Button>Открыть</Button>}
        title="Точно удалить?"
        description="Опасная операция"
        confirmLabel="Удалить"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Открыть' }));

    expect(await screen.findByText('Точно удалить?')).toBeInTheDocument();
    expect(screen.getByText('Опасная операция')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('не вызывает onConfirm при отмене', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDangerDialog
        trigger={<Button>Открыть</Button>}
        title="Заголовок"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Открыть' }));
    await screen.findByText('Заголовок');
    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
