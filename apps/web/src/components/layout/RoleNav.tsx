import type { RoleCode } from '@kinoacademia/shared';
import { Link } from '@tanstack/react-router';
import { NAV_BY_ROLE, navLinkClass } from './navItems';

type Props = { role: RoleCode };

export const RoleNav = ({ role }: Props) => {
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={navLinkClass} activeOptions={{ exact: to === '/' }}>
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
};
