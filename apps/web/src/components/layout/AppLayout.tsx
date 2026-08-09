import type { MeDto } from '@kinoacademia/shared';
import type { ReactNode } from 'react';
import { BottomTabBar } from './BottomTabBar';
import { Header } from './Header';

type Props = {
  me: MeDto;
  children: ReactNode;
};

export const AppLayout = ({ me, children }: Props) => (
  // accent-glow — свечение сверху экрана; контент поднят над ним z-индексом.
  // Нижний отступ main освобождает место под плавающий таб-бар на мобильных.
  <div className="accent-glow relative flex min-h-dvh flex-col">
    <Header me={me} />
    {/* flex-колонка, чтобы плотные экраны мониторов могли растянуться на всю
        доступную высоту через flex-1 вместо calc() с магическими числами. */}
    <main className="relative z-[1] mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 pb-28 md:pb-8">
      {children}
    </main>
    <BottomTabBar role={me.user.roleCode} />
  </div>
);
