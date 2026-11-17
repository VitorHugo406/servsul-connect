import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Per-person numbers for Gestão de Pessoas (all-time + a chosen period compared with the period before it).
 *  Counts use `head` count queries so they are never cut by the 1000-row API limit. */
export interface PersonStats {
  profileId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  // all time
  tasks: number;
  completed: number;
  messages: number;
  comments: number;
  lastActivity: string | null;
  // period
  pMessages: number;
  pPrevMessages: number;
  pCompleted: number;
  pPrevCompleted: number;
  pOpen: number;
  overdue: number;
}

const sb = supabase as any;
const cnt = async (q: any) => { const { count } = await q; return count || 0; };

export function usePeopleStats(memberIds: string[], days: number) {
  const [stats, setStats] = useState<PersonStats[]>([]);
  const [loading, setLoading] = useState(true);
  const key = memberIds.join(',');

  useEffect(() => {
    let alive = true;
    if (!memberIds.length) { setStats([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const now = new Date();
      const from = new Date(now.getTime() - days * 864e5).toISOString();
      const prevFrom = new Date(now.getTime() - 2 * days * 864e5).toISOString();
      const nowIso = now.toISOString();
      try {
        const [{ data: profs }, { data: direct }, { data: multi }] = await Promise.all([
          sb.from('profiles').select('id, name, display_name, email, avatar_url').in('id', memberIds),
          sb.from('tasks').select('id, assigned_to, status, completed_at, due_date, is_template, is_archived').in('assigned_to', memberIds).limit(10000),
          sb.from('task_assignees').select('task_id, profile_id').in('profile_id', memberIds).limit(10000),
        ]);
        const extraIds = [...new Set(((multi || []) as any[]).map((a) => a.task_id))].filter((id) => !((direct || []) as any[]).some((t) => t.id === id));
        const extra: any[] = [];
        for (let i = 0; i < extraIds.length; i += 300) {
          const { data } = await sb.from('tasks').select('id, assigned_to, status, completed_at, due_date, is_template, is_archived').in('id', extraIds.slice(i, i + 300));
          extra.push(...(data || []));
        }
        const byId = new Map<string, any>();
        [...(direct || []), ...extra].forEach((t: any) => { if (!t.is_template && !t.is_archived) byId.set(t.id, t); });
        const tasksOf = new Map<string, Set<string>>();
        const add = (p: string, id: string) => { if (!byId.has(id)) return; if (!tasksOf.has(p)) tasksOf.set(p, new Set()); tasksOf.get(p)!.add(id); };
        (direct || []).forEach((t: any) => t.assigned_to && add(t.assigned_to, t.id));
        (multi || []).forEach((a: any) => add(a.profile_id, a.task_id));

        const per = await Promise.all(memberIds.map(async (id) => {
          const msg = (t: string, col: string, a?: string, b?: string) => {
            let q = sb.from(t).select('id', { count: 'exact', head: true }).eq(col, id);
            if (a) q = q.gte('created_at', a);
            if (b) q = q.lt('created_at', b);
            return cnt(q);
          };
          const last = async (t: string, col: string) => { const { data } = await sb.from(t).select('created_at').eq(col, id).order('created_at', { ascending: false }).limit(1); return data?.[0]?.created_at || null; };
          const [m1, m2, c, pm1, pm2, pp1, pp2, l1, l2] = await Promise.all([
            msg('messages', 'author_id'), msg('direct_messages', 'sender_id'), msg('announcement_comments', 'author_id'),
            msg('messages', 'author_id', from, nowIso), msg('direct_messages', 'sender_id', from, nowIso),
            msg('messages', 'author_id', prevFrom, from), msg('direct_messages', 'sender_id', prevFrom, from),
            last('messages', 'author_id'), last('direct_messages', 'sender_id'),
          ]);
          return { id, messages: m1 + m2, comments: c, pMessages: pm1 + pm2, pPrevMessages: pp1 + pp2, lastMsg: [l1, l2].filter(Boolean).sort().pop() || null };
        }));

        const out: PersonStats[] = ((profs || []) as any[]).map((p) => {
          const ts = [...(tasksOf.get(p.id) || [])].map((id) => byId.get(id));
          const done = (t: any) => !!t.completed_at || t.status === 'done';
          const inRange = (d: string | null, a: string, b: string) => !!d && d >= a && d < b;
          const lastDone = ts.map((t) => t.completed_at).filter(Boolean).sort().pop() || null;
          const m = per.find((x) => x.id === p.id)!;
          return {
            profileId: p.id,
            name: p.display_name || p.name || 'Sem nome',
            email: p.email || '',
            avatarUrl: p.avatar_url,
            tasks: ts.length,
            completed: ts.filter(done).length,
            messages: m.messages,
            comments: m.comments,
            lastActivity: [m.lastMsg, lastDone].filter(Boolean).sort().pop() || null,
            pMessages: m.pMessages,
            pPrevMessages: m.pPrevMessages,
            pCompleted: ts.filter((t) => inRange(t.completed_at, from, nowIso)).length,
            pPrevCompleted: ts.filter((t) => inRange(t.completed_at, prevFrom, from)).length,
            pOpen: ts.filter((t) => !done(t)).length,
            overdue: ts.filter((t) => !done(t) && t.due_date && new Date(t.due_date) < now).length,
          };
        });
        if (alive) setStats(out);
      } catch (e) {
        console.error('people stats', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, days]);

  return { stats, loading };
}
