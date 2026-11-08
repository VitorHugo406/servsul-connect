// Right side panel of the desktop chat (wide screens): conversation data by default
// (messages per day, most active people, peak hour, attachments), switching to the
// people list of the sector/group (or the contact card in a direct chat).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SectorUsersList } from '@/components/sector/SectorUsersList';
import { CosmicBlob } from '@/components/common/CosmicBlob';
import { isSystemSender } from '@/lib/systemSender';
import { cn } from '@/lib/utils';
import { BarChart3, Clock, Paperclip, Link2, Users, Loader2 } from 'lucide-react';

export type InsightsKind = 'sector' | 'group' | 'dm';
export type InsightsMode = 'stats' | 'people';
interface Row { who: string; at: string; content: string }
interface Person { id: string; name: string; display_name: string | null; avatar_url: string | null; user_status?: string | null }

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const STATUS: Record<string, [string, string]> = { available: ['Disponível', '#16a34a'], busy: ['Ocupado', '#dc2626'], meeting: ['Em reunião', '#d97706'], lunch: ['Almoço', '#d97706'], away: ['Ausente', '#71717a'], offline: ['Offline', '#71717a'] };
const initials = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

async function loadRows(kind: InsightsKind, id: string, meId: string): Promise<Row[]> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  if (kind === 'sector') {
    const { data } = await supabase.from('messages').select('author_id, created_at, content').eq('sector_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(3000);
    return (data || []).map((r) => ({ who: r.author_id, at: r.created_at, content: r.content || '' }));
  }
  if (kind === 'group') {
    const { data } = await supabase.from('private_group_messages').select('sender_id, created_at, content').eq('group_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(3000);
    return (data || []).map((r) => ({ who: r.sender_id, at: r.created_at, content: r.content || '' }));
  }
  const pair = [meId, id];
  const { data } = await supabase.from('direct_messages').select('sender_id, created_at, content').in('sender_id', pair).in('receiver_id', pair).gte('created_at', since).order('created_at', { ascending: false }).limit(3000);
  return (data || []).map((r) => ({ who: r.sender_id, at: r.created_at, content: r.content || '' }));
}

export function ChatInsightsPanel({ kind, id, meId, mode, onModeChange }: { kind: InsightsKind; id: string | null; meId: string; mode: InsightsMode; onModeChange: (m: InsightsMode) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [members, setMembers] = useState<Person[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    if (!id) return;
    void loadRows(kind, id, meId).then(async (r) => {
      if (!alive) return;
      setRows(r);
      const ids = [...new Set(r.map((x) => x.who).concat(kind === 'dm' ? [id] : []))];
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id, name, display_name, avatar_url, user_status').in('id', ids);
        if (alive) setPeople(Object.fromEntries((data || []).map((p) => [p.id, p as Person])));
      }
    }).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [kind, id, meId]);

  useEffect(() => {
    let alive = true;
    setMembers(null);
    if (kind !== 'group' || !id || mode !== 'people') return;
    void (async () => {
      const { data: m } = await supabase.from('private_group_members').select('profile_id, role').eq('group_id', id);
      const ids = (m || []).map((x) => x.profile_id);
      const { data } = ids.length ? await supabase.from('profiles').select('id, name, display_name, avatar_url, user_status').in('id', ids) : { data: [] };
      if (alive) setMembers(((data || []) as Person[]).sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name)));
    })();
    return () => { alive = false; };
  }, [kind, id, mode]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today0.getTime() - (6 - i) * 864e5); return { d, n: 0 }; });
    const byWho = new Map<string, number>();
    const hours = new Array(24).fill(0);
    let files = 0, links = 0, week = 0;
    for (const r of rows) {
      const t = new Date(r.at);
      const idx = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - days[0].d.getTime()) / 864e5);
      if (idx >= 0 && idx < 7) { days[idx].n++; week++; byWho.set(r.who, (byWho.get(r.who) || 0) + 1); }
      hours[t.getHours()]++;
      if (/📷|📎|✨ sticker:|🎤/.test(r.content)) files++;
      if (/https?:\/\//.test(r.content)) links++;
    }
    const max = Math.max(1, ...days.map((d) => d.n));
    const peak = rows.length ? hours.indexOf(Math.max(...hours)) : null;
    const top = [...byWho.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return { days, max, week, peak, files, links, top, month: rows.length };
  }, [rows]);

  if (!id) return null;
  const partner = kind === 'dm' ? people[id] : null;
  const name = (p?: Person | null) => (p ? p.display_name || p.name : 'Alguém');

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border/60 bg-card xl:flex" aria-label="Detalhes da conversa">
      <div className="m-3 flex gap-1 rounded-2xl bg-muted/70 p-1">
        {(['stats', 'people'] as const).map((m) => (
          <button key={m} type="button" onClick={() => onModeChange(m)}
            className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors', mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {m === 'stats' ? <BarChart3 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {m === 'stats' ? 'Dados' : kind === 'dm' ? 'Contato' : 'Pessoas'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {mode === 'stats' ? (
          !stats ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border/60 p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Mensagens nos últimos 7 dias</p>
                  <p className="text-lg font-semibold text-foreground">{stats.week}</p>
                </div>
                <div className="mt-3 flex h-24 items-end gap-[2px]" role="img" aria-label={`Mensagens por dia: ${stats.days.map((d) => `${d.d.toLocaleDateString('pt-BR', { weekday: 'short' })} ${d.n}`).join(', ')}`}>
                  {stats.days.map((d, i) => (
                    <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
                      <span className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
                        {d.d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}: {d.n}
                      </span>
                      <div className="w-full rounded-t-[4px] bg-foreground/80 transition-colors group-hover:bg-foreground" style={{ height: `${Math.max(d.n ? 6 : 2, (d.n / stats.max) * 100)}%`, opacity: d.n ? 1 : 0.25 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-[2px]">{stats.days.map((d, i) => <span key={i} className={cn('flex-1 text-center text-[10px] text-muted-foreground', i === 6 && 'font-semibold text-foreground')}>{DAYS[d.d.getDay()]}</span>)}</div>
              </section>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border/60 p-2.5 text-center"><Clock className="mx-auto h-4 w-4 text-muted-foreground" /><p className="mt-1 text-sm font-semibold">{stats.peak === null ? '—' : `${String(stats.peak).padStart(2, '0')}h`}</p><p className="text-[10px] text-muted-foreground">pico</p></div>
                <div className="rounded-2xl border border-border/60 p-2.5 text-center"><Paperclip className="mx-auto h-4 w-4 text-muted-foreground" /><p className="mt-1 text-sm font-semibold">{stats.files}</p><p className="text-[10px] text-muted-foreground">mídias</p></div>
                <div className="rounded-2xl border border-border/60 p-2.5 text-center"><Link2 className="mx-auto h-4 w-4 text-muted-foreground" /><p className="mt-1 text-sm font-semibold">{stats.links}</p><p className="text-[10px] text-muted-foreground">links</p></div>
              </div>
              <p className="-mt-2 text-[10px] text-muted-foreground">Pico, mídias e links: últimos 30 dias ({stats.month} mensagens).</p>

              {stats.top.length ? (
                <section>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Mais ativos na semana</p>
                  <div className="space-y-2">
                    {stats.top.map(([who, n]) => {
                      const p = people[who];
                      return (
                        <div key={who} className="flex items-center gap-2.5">
                          {isSystemSender(who) ? <CosmicBlob size={30} /> : <Avatar className="h-8 w-8"><AvatarImage src={p?.avatar_url || ''} /><AvatarFallback className="text-[10px]">{initials(name(p))}</AvatarFallback></Avatar>}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{who === meId ? 'Você' : name(p)}</p>
                            <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${(n / stats.top[0][1]) * 100}%` }} /></div>
                          </div>
                          <span className="text-xs font-semibold text-foreground">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : <p className="py-6 text-center text-sm text-muted-foreground">Sem mensagens nesta semana.</p>}
            </div>
          )
        ) : kind === 'sector' ? (
          <div className="-mx-4"><SectorUsersList sectorId={id} inline /></div>
        ) : kind === 'group' ? (
          !members ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <div className="space-y-1">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{members.length} pessoas no grupo</p>
              {members.map((p) => {
                const st = STATUS[p.user_status || 'available'] || STATUS.available;
                return (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-muted/60">
                    <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url || ''} /><AvatarFallback className="text-[10px]">{initials(name(p))}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm">{p.id === meId ? `${name(p)} (você)` : name(p)}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st[1] }} />{st[0]}</p></div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 pt-4 text-center">
            {isSystemSender(id) ? <CosmicBlob size={88} /> : <Avatar className="h-20 w-20"><AvatarImage src={partner?.avatar_url || ''} /><AvatarFallback>{initials(name(partner))}</AvatarFallback></Avatar>}
            <p className="text-base font-semibold">{isSystemSender(id) ? 'Comunicados' : name(partner)}</p>
            <p className="text-xs text-muted-foreground">{isSystemSender(id) ? 'Resumos, boas-vindas e feedback mensal' : (STATUS[partner?.user_status || 'available'] || STATUS.available)[0]}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
