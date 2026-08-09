import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const systemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === 'system' ? systemTheme() : mode;

const applyTheme = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Тёмная по умолчанию: игра ночная, макет помечает тёмную тему основной.
      mode: 'dark',
      setMode: (mode) => {
        set({ mode });
        applyTheme(mode);
      },
      toggle: () => {
        const current = resolveTheme(get().mode);
        const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
        set({ mode: next });
        applyTheme(next);
      },
    }),
    {
      name: 'ka-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.mode);
      },
    },
  ),
);

export const initTheme = (): void => {
  applyTheme(useThemeStore.getState().mode);

  if (typeof window === 'undefined') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system');
  });
};
