import type { RoleCode } from '@kinoacademia/shared';
import {
  Award,
  Briefcase,
  ClipboardList,
  Home,
  Monitor,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Единый набор разделов по ролям — им пользуются и верхняя панель на десктопе,
 * и нижний таб-бар на мобильных. Не больше пяти пунктов на роль: это ширина
 * плавающей пилюли из макета, шестой пункт в неё уже не помещается.
 */
export const NAV_BY_ROLE: Record<RoleCode, NavItem[]> = {
  emp: [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/my-rating', label: 'Рейтинг', icon: Sparkles },
    { to: '/compare', label: 'Сравнить', icon: Award },
    { to: '/my-contracts', label: 'Контракты', icon: ClipboardList },
    { to: '/profile', label: 'Профиль', icon: User },
  ],
  // Разделы компании (фильмы, номинации, документы) живут в CompanySubNav —
  // здесь остаются личные страницы, доступные каждому участнику по правилам игры.
  head: [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/company/contracts', label: 'Компания', icon: Briefcase },
    { to: '/my-rating', label: 'Рейтинг', icon: Sparkles },
    { to: '/my-contracts', label: 'Контракты', icon: ClipboardList },
    { to: '/profile', label: 'Профиль', icon: User },
  ],
  info: [
    { to: '/', label: 'Главная', icon: Home },
    { to: '/info/ratings', label: 'Все рейтинги', icon: Monitor },
    { to: '/info/contracts-history', label: 'Перезаключения', icon: ClipboardList },
    { to: '/display/leaderboard', label: 'Экран', icon: Monitor },
    { to: '/profile', label: 'Профиль', icon: User },
  ],
  // У админа нет игрового персонажа, поэтому главная и профиль для него пусты
  // и заменены редиректом в админку — см. beforeLoad в routes/_auth.index.tsx.
  admin: [
    { to: '/admin/users', label: 'Админка', icon: Shield },
    { to: '/info/ratings', label: 'Все рейтинги', icon: Monitor },
    { to: '/display/leaderboard', label: 'Экран', icon: Monitor },
  ],
};

/**
 * Пилюля раздела — общий вид для всех навигаций приложения.
 * Раньше эта строка была скопирована дословно в четыре компонента.
 */
export const navLinkClass =
  'inline-flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold text-[var(--color-muted-fg)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] [&.active]:bg-[var(--color-accent)] [&.active]:text-[var(--color-accent-fg)]';
