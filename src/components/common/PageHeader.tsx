// Standard page header for desktop tabs (2026-11 professional redesign): a flat title row with a
// short description and the tab's actions, separated from the content by a hairline. `icon` and
// `eyebrow` is accepted for compatibility but not rendered; `icon` becomes a small 3D mark (no emojis).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TabMark3D } from './TabMark3D';

export function PageHeader({ icon, title, subtitle, actions, children, className }: {
  icon?: ReactNode; eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <header className={cn('pro-page-header border-b border-border pb-4', className)}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <TabMark3D icon={icon} /> : null}
          <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold leading-7 text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
