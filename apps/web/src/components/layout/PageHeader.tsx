import { PageTitle } from '@/components/ui/typography';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Куда ведёт шеврон «назад». Без него заголовок рисуется без стрелки. */
  backTo?: string;
  /** Надзаголовок золотым моноширинным — в макете это название компании над разделом. */
  overline?: string;
  description?: ReactNode;
  actions?: ReactNode;
};

/**
 * Заголовок внутреннего экрана: шеврон назад плюс название акцидентным шрифтом.
 * В макете так озаглавлены все страницы второго уровня.
 */
export const PageHeader = ({ title, backTo, overline, description, actions }: Props) => (
  <div className="mb-5 flex items-start gap-3">
    {backTo && (
      <Link
        to={backTo}
        aria-label="Назад"
        className="mt-0.5 shrink-0 rounded-[var(--radius-md)] p-1 text-[var(--color-fg)] transition-colors hover:bg-[var(--color-muted)]"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
    )}
    <div className="min-w-0 flex-1">
      {overline && (
        <div className="font-[family-name:var(--font-mono)] mb-1.5 truncate text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          {overline}
        </div>
      )}
      <PageTitle>{title}</PageTitle>
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-subtle-fg)]">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
