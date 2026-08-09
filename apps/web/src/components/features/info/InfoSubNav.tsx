import { navLinkClass } from '@/components/layout/navItems';
import { Link } from '@tanstack/react-router';
import { Award, ClipboardList, Film, Star } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type SubNavItem = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const ITEMS: SubNavItem[] = [
  { to: '/info/ratings', label: 'Все рейтинги', icon: Star },
  { to: '/info/contracts-history', label: 'Перезаключения', icon: ClipboardList },
  { to: '/info/oscars', label: 'Новости церемонии', icon: Award },
  { to: '/info/films', label: 'Фильмы', icon: Film },
];

export const InfoSubNav = () => (
  <nav
    aria-label="Разделы мониторов"
    className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] pb-2"
  >
    {ITEMS.map(({ to, label, icon: Icon }) => (
      <Link key={to} to={to} className={navLinkClass}>
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </Link>
    ))}
  </nav>
);
