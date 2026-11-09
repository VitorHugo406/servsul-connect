import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/passwordPolicy';
import { cn } from '@/lib/utils';

// Live checklist of the password rule (src/lib/passwordPolicy.ts) shown under password fields.
export function PasswordChecklist({ value, className, tone = 'default' }: { value: string; className?: string; tone?: 'default' | 'onDark' }) {
  return (
    <ul className={cn('grid gap-1 text-xs', className)} aria-label="Requisitos da senha">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.id} className={cn('flex items-center gap-1.5', ok ? (tone === 'onDark' ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400') : (tone === 'onDark' ? 'text-white/60' : 'text-muted-foreground'))}>
            {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            <span>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
