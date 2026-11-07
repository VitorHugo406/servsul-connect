// Standard page header for desktop tabs, matching the Início hero card:
// glass card, eyebrow + date, large title, subtitle, icon tile and actions.
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function PageHeader({ icon, eyebrow, title, subtitle, actions, children, className }: {
  icon?: ReactNode; eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <section className={cn('ewvon-page-header ewvon-glass-panel relative overflow-hidden rounded-[24px] border border-white/80 p-4 shadow-[0_12px_45px_rgba(24,24,27,0.045)] sm:p-5', className)}>
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-zinc-200/50 blur-3xl dark:bg-zinc-700/20" />
      <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          {icon ? <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm ring-4 ring-zinc-100 dark:bg-white dark:text-zinc-900 dark:ring-zinc-800 [&_svg]:h-6 [&_svg]:w-6">{icon}</div> : null}
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-[.16em] text-zinc-500">{eyebrow || 'Seu espaço de trabalho'}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className="text-xs text-zinc-500">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="relative mt-4">{children}</div> : null}
    </section>
  );
}
