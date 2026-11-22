// Card notifications in the PC bell (user_notifications of type task_reminder / approval / automation): prazo
// chegando, card atrasado, aprovação pedida / aprovada / recusada and mural automations. Clicking one marks it as
// read and opens the card in its mural (/tarefas/<slug>-<id>?abrir=<task>).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, BadgeCheck, CalendarCheck2, ClipboardList, Heart, Target, TreePalm, Users, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CARD_NOTIF_TYPES } from '@/hooks/useNotifications';

type N = { id: string; type: string; title: string; message: string; reference_id: string | null; created_at: string };
const db = supabase as any;
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function CardNotifications({ onDone, refreshKey }: { onDone?: () => void; refreshKey?: number }) {
  const { user } = useAuth(); const navigate = useNavigate();
  const [rows, setRows] = useState<N[]>([]);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from('user_notifications').select('id,type,title,message,reference_id,created_at').eq('user_id', user.id).eq('is_read', false).in('type', CARD_NOTIF_TYPES).order('created_at', { ascending: false }).limit(20);
    setRows(data || []);
  }, [user]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  if (!rows.length) return null;

  const open = async (n: N) => {
    await db.from('user_notifications').update({ is_read: true }).eq('id', n.id);
    setRows((r) => r.filter((x) => x.id !== n.id));
    // agenda / RH notifications open their screen (the RH tab is remembered in localStorage by RhSection)
    const RH: Record<string, string> = { time_off: 'timeoff', survey: 'surveys', one_on_one: 'oneonone', feedback: 'feedback', goal: 'goals' };
    if (n.type === 'booking') { onDone?.(); navigate('/calendario'); return; }
    if (RH[n.type]) { try { localStorage.setItem('ewvon:rh-tab', RH[n.type]); } catch { /* storage unavailable */ } onDone?.(); navigate('/rh'); return; }
    if (!n.reference_id) return;
    const { data: t } = await db.from('tasks').select('board_id').eq('id', n.reference_id).maybeSingle();
    if (!t?.board_id) return;
    const { data: b } = await db.from('task_boards').select('id,name').eq('id', t.board_id).maybeSingle();
    if (!b) return;
    onDone?.(); navigate(`/tarefas/${slug(b.name)}-${b.id}?abrir=${n.reference_id}`);
  };
  const readAll = async () => { const ids = rows.map((r) => r.id); setRows([]); await db.from('user_notifications').update({ is_read: true }).in('id', ids); };
  const Ico = (t: string) => ({ approval: BadgeCheck, automation: Zap, booking: CalendarCheck2, time_off: TreePalm, survey: ClipboardList, one_on_one: Users, feedback: Heart, goal: Target } as Record<string, typeof AlarmClock>)[t] || AlarmClock;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cards, agenda e RH</span>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => void readAll()}>Marcar como lidas</button></div>
      <div className="space-y-1">
        {rows.map((n) => { const I = Ico(n.type); const bad = /atrasad|Recusado/.test(n.title); return (
          <button key={n.id} type="button" onClick={() => void open(n)} className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-muted/60">
            <span className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-lg ${bad ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300' : 'bg-muted text-muted-foreground'}`}><I className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><b className="block text-[13px] font-medium">{n.title}</b><span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
              <span className="text-[11px] text-muted-foreground/80">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</span></span>
          </button>); })}
      </div>
    </div>
  );
}
