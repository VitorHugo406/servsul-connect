import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystemBroadcasts } from '@/hooks/useSystemBroadcasts';

const DISMISS_KEY = 'nuvexa-dismissed-broadcasts';

export function SystemBroadcastBanner() {
  const { broadcasts } = useSystemBroadcasts(true);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'));
    } catch {
      setDismissed([]);
    }
  }, []);

  const now = Date.now();
  const visible = broadcasts.filter(
    (b) =>
      !dismissed.includes(b.id) &&
      new Date(b.starts_at).getTime() <= now &&
      (!b.ends_at || new Date(b.ends_at).getTime() >= now),
  );

  if (visible.length === 0) return null;
  const item = visible[0];

  const dismiss = () => {
    const next = [...dismissed, item.id];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  };

  const Icon = item.severity === 'critical' ? AlertTriangle : item.severity === 'warning' ? Megaphone : Info;

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b px-4 py-2.5 text-sm',
        item.severity === 'critical'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : item.severity === 'warning'
            ? 'border-secondary/30 bg-secondary/10 text-foreground'
            : 'border-primary/20 bg-primary/5 text-foreground',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{item.title}</span>
        <span className="ml-2 text-muted-foreground">{item.content}</span>
      </div>
      <button onClick={dismiss} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
