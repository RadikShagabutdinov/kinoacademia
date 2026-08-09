import { navLinkClass } from '@/components/layout/navItems';
import { SectionLabel } from '@/components/ui/typography';
import { Link } from '@tanstack/react-router';
import {
  Award,
  Building2,
  ClipboardList,
  Coins,
  FileText,
  Film,
  Settings,
  Shuffle,
  UserSquare2,
  Users,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type Item = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const ITEMS: Item[] = [
  { to: '/admin/users', label: 'Пользователи', icon: Users },
  { to: '/admin/persons', label: 'Персонажи', icon: UserSquare2 },
  { to: '/admin/companies', label: 'Компании', icon: Building2 },
  { to: '/admin/randomizer', label: 'Рандомайзер', icon: Shuffle },
  { to: '/admin/transactions', label: 'Транзакции', icon: Coins },
  { to: '/admin/contracts', label: 'Контракты', icon: ClipboardList },
  { to: '/admin/oscars', label: 'Оскары', icon: Award },
  { to: '/admin/films', label: 'Фильмы', icon: Film },
  { to: '/admin/default-scans', label: 'Типовые контракты', icon: FileText },
  { to: '/admin/jobs', label: 'Задачи (cron)', icon: Settings },
];

/**
 * Разделы админки. На десктопе — боковая колонка из макета; мобильного макета
 * для админки нет (2i нарисован под 1440), поэтому там остаётся строка пилюль.
 */
export const AdminSideNav = () => (
  <>
    <nav
      aria-label="Разделы админки"
      className="hidden w-[212px] shrink-0 flex-col gap-0.5 self-start rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-row-alt)] p-3 lg:flex"
    >
      <SectionLabel className="px-2 pb-2.5 pt-1">Админка</SectionLabel>
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={`${navLinkClass} w-full`}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>

    <nav
      aria-label="Разделы админки"
      className="flex w-full flex-wrap items-center gap-1 border-b border-[var(--color-border)] pb-2 lg:hidden"
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={navLinkClass}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  </>
);
