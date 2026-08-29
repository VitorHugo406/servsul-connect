import { useEffect, useMemo, useState } from 'react';
import { Link, ExternalLink, Plus, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = { Link, ExternalLink, Plus, Pencil };
const iconNames = ['Link', 'ExternalLink', 'Plus', 'Pencil'];

type Shortcut = { id: string; name: string; url: string; icon: string };

export function getShortcutIcon(name: string): LucideIcon {
  return ICONS[name] || Link;
}

export function SystemShortcutBar({ onManage }: { onManage?: () => void }) {
  const { profile, isAdmin } = useAuth();
  const { company } = useCompany();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);

  const load = async () => {
    if (!profile?.id || !company?.id) return;
    const { data, error } = await (supabase as any).from('system_shortcuts').select('id,name,url,icon').eq('company_id', company.id).eq('is_active', true).order('created_at', { ascending: true });
    if (error) return;
    setShortcuts((data || []) as Shortcut[]);
  };

  useEffect(() => {
    void load();
    const handler = () => void load();
    window.addEventListener('nuvexa:shortcuts-changed', handler);
    return () => window.removeEventListener('nuvexa:shortcuts-changed', handler);
  }, [profile?.id, company?.id]);

  const visible = useMemo(() => shortcuts.filter(s => s.url), [shortcuts]);
  if (!profile || !company || (visible.length === 0 && !isAdmin)) return null;

  return (
    <div className="flex max-w-[42vw] min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none">
      {visible.map(shortcut => {
        const Icon = getShortcutIcon(shortcut.icon);
        return <Button key={shortcut.id} variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5" asChild title={shortcut.name}>
          <a href={shortcut.url} target="_blank" rel="noopener noreferrer"><Icon className="h-3.5 w-3.5" /><span className="max-w-28 truncate">{shortcut.name}</span></a>
        </Button>;
      })}
      {isAdmin && visible.length === 0 && <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg" onClick={onManage}><Link className="h-3.5 w-3.5" />Criar atalho</Button>}
    </div>
  );
}

export { iconNames };
