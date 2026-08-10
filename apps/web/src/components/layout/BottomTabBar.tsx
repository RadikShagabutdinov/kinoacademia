import { cn } from '@/lib/utils';
import type { RoleCode } from '@kinoacademia/shared';
import { Link } from '@tanstack/react-router';
import { NAV_BY_ROLE } from './navItems';

type Props = { role: RoleCode };

/**
 * Плавающая пилюля навигации внизу экрана — основной способ перемещения
 * на мобильных. Активный пункт разворачивается в золотую плашку с подписью,
 * остальные остаются иконками: так пилюля вмещает пять разделов на 390px.
 * Ширина — по содержимому, чтобы у ролей с меньшим числом разделов
 * (админ) пункты не расползались по краям.
 */
export const BottomTabBar = ({ role }: Props) => {
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label="Основная навигация"
        className="mx-auto flex w-fit max-w-md items-center justify-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-elevated)_92%,transparent)] px-2.5 py-2 backdrop-blur-xl"
      >
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/' }}
            aria-label={label}
            className={cn(
              'group flex min-w-0 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-3 py-2 text-[var(--color-muted-fg)] transition-colors',
              '[&.active]:bg-[var(--color-accent)] [&.active]:text-[var(--color-accent-fg)]',
            )}
          >
            <Icon className="h-[21px] w-[21px] shrink-0" />
            <span className="hidden truncate text-xs font-extrabold group-[.active]:inline">
              {label}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
