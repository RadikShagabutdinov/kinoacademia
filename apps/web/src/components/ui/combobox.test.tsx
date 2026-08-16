import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxOption } from './combobox';

const PERSONS: ComboboxOption[] = [
  'Астра Нова',
  'Влад Кэрролайн',
  'Гэвин Карбайн',
  'Джина Моретти',
  'Кара Вонг',
  'Мэри Макмиллан',
  'Саша Блум',
  'Холди Уэзерс',
  'Элис Фокс',
].map((label, i) => ({ value: `p${i}`, label }));

describe('Combobox', () => {
  it('открывается, ищет по подстроке и возвращает выбранное значение', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Combobox
        value=""
        onChange={onChange}
        options={PERSONS}
        placeholder="Персонаж: все"
        searchPlaceholder="Поиск персонажа"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Персонаж: все' }));

    const search = await screen.findByLabelText('Поиск персонажа');
    await user.type(search, 'бл');

    // Плюс пункт-плейсхолдер «Персонаж: все», который сбрасывает фильтр.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Саша Блум' }));
    expect(onChange).toHaveBeenCalledWith('p6');
  });

  it('показывает крестик только при выбранном значении и сбрасывает им фильтр', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <Combobox value="" onChange={onChange} options={PERSONS} placeholder="Персонаж: все" />,
    );
    expect(screen.queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument();

    rerender(
      <Combobox value="p6" onChange={onChange} options={PERSONS} placeholder="Персонаж: все" />,
    );
    expect(screen.getByRole('button', { name: 'Персонаж: все' })).toHaveTextContent('Саша Блум');

    await user.click(screen.getByRole('button', { name: 'Сбросить: Персонаж: все' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('не показывает поиск на коротком списке и не даёт сбросить при clearable={false}', async () => {
    const user = userEvent.setup();

    render(
      <Combobox
        value="all"
        onChange={vi.fn()}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'open', label: 'Открытые' },
        ]}
        placeholder="Все"
        clearable={false}
        aria-label="Фильтр по статусу"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Фильтр по статусу' }));

    expect(screen.queryByLabelText('Поиск…')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Сбросить/ })).not.toBeInTheDocument();
  });
});
