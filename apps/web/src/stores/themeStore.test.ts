import { beforeEach, describe, expect, it } from 'vitest';
import { resolveTheme, useThemeStore } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    useThemeStore.setState({ mode: 'system' });
  });

  it('по умолчанию тёмная тема', () => {
    expect(useThemeStore.getInitialState().mode).toBe('dark');
  });

  it('переключает режим и обновляет data-theme', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    useThemeStore.getState().setMode('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('toggle инвертирует resolved тему', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('resolveTheme учитывает системную настройку', () => {
    expect(['light', 'dark']).toContain(resolveTheme('system'));
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });
});
