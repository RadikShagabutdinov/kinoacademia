import { PageHeader } from '@/components/layout/PageHeader';
import type { ReactNode } from 'react';
import { AdminSideNav } from './AdminSideNav';

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Правая колонка 360px для опасных действий — как рельс в макете админки. */
  aside?: ReactNode;
  children: ReactNode;
};

export const AdminLayout = ({ title, description, actions, aside, children }: Props) => (
  <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
    <AdminSideNav />
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHeader
        title={title}
        overline="Мастер игры"
        {...(description ? { description } : {})}
        {...(actions ? { actions } : {})}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
        {aside && (
          <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">{aside}</aside>
        )}
      </div>
    </div>
  </div>
);
