import { navLinkClass } from '@/components/layout/navItems';
import type { BranchCode } from '@kinoacademia/shared';
import { Link } from '@tanstack/react-router';
import { Award, FileText, Film, Sparkles, Wallet } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

type SubNavItem = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const BASE_ITEMS: SubNavItem[] = [
  { to: '/company/rating', label: 'Рейтинг', icon: Sparkles },
  { to: '/company/contracts', label: 'Контракты', icon: Wallet },
  { to: '/company/documents', label: 'Документы', icon: FileText },
];

const CINEMA_ONLY_ITEMS: SubNavItem[] = [
  { to: '/company/oscar-nominations', label: 'Номинации', icon: Award },
  { to: '/company/films', label: 'Фильмы', icon: Film },
];

type Props = {
  branchCode: BranchCode;
};

export const CompanySubNav = ({ branchCode }: Props) => {
  const items = branchCode === 'cinema' ? [...BASE_ITEMS, ...CINEMA_ONLY_ITEMS] : BASE_ITEMS;

  return (
    <nav
      aria-label="Разделы компании"
      className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] pb-2"
    >
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={navLinkClass}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
};
