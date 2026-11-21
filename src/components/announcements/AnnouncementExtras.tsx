// Avisos (pack 4, migration 20261121010000): mandatory reading ("Li e concordo" + who has not confirmed yet),
// announcements for chosen sectors only, and a poll inside the announcement. useDbFeature keeps all of it hidden
// until the tables exist, so the screen never offers something the database cannot store.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDbColumn, useDbFeature } from '@/hooks/useDbFeature';
import { useSectors } from '@/hooks/useData';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PollCard } from '@/components/chat/extras/ChatPoll';
import { formatText } from '@/lib/chatFormatUtils';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/chat-extras.css';

const db = supabase as any;

export function useAnnouncementExtras(ids: string[]) {
  const { user } = useAuth();
  const meId = user?.id;
  const ackOn = useDbColumn('announcements', 'require_ack');
  const pollsOn = useDbFeature('polls');
  const [acked, setAcked] = useState<Map<string, string>>(new Map());
  const [polls, setPolls] = useState<Map<string, string>>(new Map());
  const key = ids.join(',');
  const reload = useCallback(async () => {
    if (!ids.length) { setAcked(new Map()); setPolls(new Map()); return; }
    if (ackOn && meId) {
      const { data } = await db.from('announcement_reads').select('announcement_id,acked_at').eq('user_id', meId).not('acked_at', 'is', null).in('announcement_id', ids);
      setAcked(new Map(((data || []) as { announcement_id: string; acked_at: string }[]).map((r) => [r.announcement_id, r.acked_at])));
    }
    if (pollsOn) {
      const { data } = await db.from('polls').select('id,context_key').eq('context', 'announcement').in('context_key', ids);
      setPolls(new Map(((data || []) as { id: string; context_key: string }[]).map((p) => [p.context_key, p.id])));
    }
  }, [key, ackOn, pollsOn, meId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { ackOn, pollsOn, acked, polls, reload };
}

/** "Li e concordo": the same confirmation the mobile app's "Ciente" writes (announcement_reads.acked_at). */
export async function ackAnnouncement(id: string) {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error('auth');
  const now = new Date().toISOString();
  const { error } = await db.from('announcement_reads').upsert({ announcement_id: id, user_id: uid, read_at: now, acked_at: now }, { onConflict: 'announcement_id,user_id' });
  if (error) throw error;
}

/** Chip row to choose the sectors that see the announcement (none chosen = everybody). */
export function SectorPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { sectors } = useSectors();
  const list = (sectors || []).filter((s: any) => !s.is_general);
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className="ui-chip" aria-pressed={value.length === 0} onClick={() => onChange([])}>Todos os usuários</button>
      {list.map((s: any) => {
        const on = value.includes(s.id);
        return <button key={s.id} type="button" className="ui-chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== s.id) : [...value, s.id])}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: s.color || 'hsl(var(--primary))' }} />{s.name}
        </button>;
      })}
    </div>
  );
}

export function useSectorNames() {
  const { sectors } = useSectors();
  return useMemo(() => new Map((sectors || []).map((s: any) => [s.id as string, s.name as string])), [sectors]);
}

type AckRow = { profile_id: string; name: string; sector: string | null; avatar_url: string | null; acked_at: string | null };

/** Author/admin view: who confirmed the reading and who has not yet (from announcement_ack_status). */
export function AckStatusDialog({ id, title, open, onOpenChange }: { id: string | null; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [rows, setRows] = useState<AckRow[] | null>(null);
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  useEffect(() => {
    if (!open || !id) return;
    setRows(null); setTab('pending');
    void db.rpc('announcement_ack_status', { _id: id }).then(({ data, error }: { data: AckRow[] | null; error: unknown }) => setRows(error ? [] : data || []));
  }, [open, id]);
  const pending = (rows || []).filter((r) => !r.acked_at);
  const done = (rows || []).filter((r) => r.acked_at);
  const list = tab === 'pending' ? pending : done;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmações de leitura</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        {rows === null ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="cx-seg" role="group" aria-label="Filtro">
              <button type="button" aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>Ainda não confirmaram ({pending.length})</button>
              <button type="button" aria-pressed={tab === 'done'} onClick={() => setTab('done')}>Confirmaram ({done.length})</button>
            </div>
            <span className="flex-1" />
            <ExportMenu className="dk-btn" getData={() => ({ name: `confirmacoes-${title}`, sheet: 'Confirmações', headers: ['Nome', 'Setor', 'Situação', 'Confirmado em'], rows: (rows || []).map((r) => [r.name, r.sector || '', r.acked_at ? 'Confirmou' : 'Pendente', r.acked_at ? new Date(r.acked_at).toLocaleString('pt-BR') : '']) })} />
          </div>
          <div className="flex max-h-[50vh] flex-col gap-1 overflow-auto">
            {list.length ? list.map((r) => (
              <div key={r.profile_id} className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-muted/60">
                {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{r.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>}
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{r.name}</div><div className="truncate text-xs text-muted-foreground">{r.sector || 'Sem setor'}</div></div>
                <span className="text-xs text-muted-foreground">{r.acked_at ? new Date(r.acked_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Pendente'}</span>
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">{tab === 'pending' ? 'Todo mundo já confirmou.' : 'Ninguém confirmou ainda.'}</p>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}

/** Full announcement for reading: content, poll and the "Li e concordo" confirmation. */
export function AnnouncementDetailDialog({ a, open, onOpenChange, pollId, ackedAt, onAcked, audience }: { a: any | null; open: boolean; onOpenChange: (o: boolean) => void; pollId?: string; ackedAt?: string; onAcked: () => void; audience: string }) {
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  const confirm = async () => {
    setBusy(true);
    try { await ackAnnouncement(a.id); toast.success('Leitura confirmada'); onAcked(); }
    catch { toast.error('Não foi possível confirmar a leitura.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{a.title}</DialogTitle>
          <DialogDescription>{[a.author?.display_name || a.author?.name, a.start_at || a.created_at ? new Date(a.start_at || a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '', audience].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[46vh] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{String(a.content || '').split('\n').map((l: string, i: number) => <p key={i} className="min-h-[1.2em]">{formatText(l, false)}</p>)}</div>
        {pollId ? <div className="rounded-[12px] border border-border p-3"><PollCard id={pollId} /></div> : null}
        {a.require_ack ? (ackedAt
          ? <div className="flex items-center gap-2 rounded-[10px] bg-muted/60 px-3 py-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Você confirmou a leitura em {new Date(ackedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</div>
          : <Button onClick={() => void confirm()} disabled={busy} className="w-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Li e concordo</Button>) : null}
      </DialogContent>
    </Dialog>
  );
}
