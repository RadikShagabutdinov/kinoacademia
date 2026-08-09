import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type ThemeMode, useThemeStore } from '@/stores/themeStore';
import { Monitor, Moon, Sun } from 'lucide-react';

const items: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Светлая', icon: Sun },
  { mode: 'dark', label: 'Тёмная', icon: Moon },
  { mode: 'system', label: 'Системная', icon: Monitor },
];

export const ThemeToggle = () => {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const Active = items.find((i) => i.mode === mode)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Переключить тему">
          <Active className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ mode: m, label, icon: Icon }) => (
          <DropdownMenuItem key={m} onSelect={() => setMode(m)}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
