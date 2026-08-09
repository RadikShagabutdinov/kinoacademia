import { useWsOnline } from '@/hooks/useWs';
import type { MeDto } from '@kinoacademia/shared';
import { Link } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { RoleNav } from './RoleNav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

type Props = { me: MeDto };

const RealtimeIndicator = () => {
  const online = useWsOnline();
  return (
    <div
      className="hidden items-center gap-2 text-[11px] font-semibold lg:flex"
      style={{ color: online ? 'var(--color-success)' : 'var(--color-subtle-fg)' }}
    >
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{ background: 'currentColor' }}
        aria-hidden
      />
      {online ? 'realtime' : 'нет связи'}
    </div>
  );
};

export const Header = ({ me }: Props) => {
  const { person, user } = me;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:h-16">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="font-[family-name:var(--font-display)] truncate text-[19px] font-black leading-none">
            Киноакадемия
          </span>
        </Link>

        {/* Разделы на десктопе; на мобильных за навигацию отвечает нижний таб-бар. */}
        <nav className="ml-2 hidden flex-1 md:block">
          <RoleNav role={user.roleCode} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <RealtimeIndicator />
          <span className="hidden items-center gap-1 text-sm font-bold leading-tight sm:flex">
            {person?.isStar && (
              <Star className="h-3.5 w-3.5 fill-current" style={{ color: 'var(--color-star)' }} />
            )}
            {person?.displayName ?? user.login}
          </span>
          <ThemeToggle />
          <UserMenu me={me} />
        </div>
      </div>
    </header>
  );
};
