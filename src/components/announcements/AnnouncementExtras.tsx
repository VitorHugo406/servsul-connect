// Avisos (pack 4, migration 20261121010000): mandatory reading ("Li e concordo" + who has not confirmed yet),
// announcements for chosen sectors only, and a poll inside the announcement. useDbFeature keeps all of it hidden
// until the tables exist, so the screen never offers something the database cannot store.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, ImagePlus, Images, Loader2, Pin, ShieldCheck, Users, X } from 'lucide-react';
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
import { listAnnouncementMedia, mediaAccept, mediaProblem, mediaType, MEDIA_MAX_FILES, type AnnMedia } from '@/lib/announcementMedia';
import '@/styles/chat-extras.css';
import '@/styles/announcement-view.css';

const db = supabase as any;

export function useAnnouncementExtras(ids: string[]) {
  const { user } = useAuth();
  const meId = user?.id;
  const ackOn = useDbColumn('announcements', 'require_ack');
  const pollsOn = useDbFeature('polls');
  const mediaOn = useDbFeature('announcement_media');
  const [acked, setAcked] = useState<Map<string, string>>(new Map());
  const [polls, setPolls] = useState<Map<string, string>>(new Map());
  const [media, setMedia] = useState<Map<string, AnnMedia[]>>(new Map());
  const key = ids.join(',');
  const reload = useCallback(async () => {
    if (!ids.length) { setAcked(new Map()); setPolls(new Map()); setMedia(new Map()); return; }
    if (mediaOn) setMedia(await listAnnouncementMedia(ids));
    if (ackOn && meId) {
      const { data } = await db.from('announcement_reads').select('announcement_id,acked_at').eq('user_id', meId).not('acked_at', 'is', null).in('announcement_id', ids);
      setAcked(new Map(((data || []) as { announcement_id: string; acked_at: string }[]).map((r) => [r.announcement_id, r.acked_at])));
    }
    if (pollsOn) {
      const { data } = await db.from('polls').select('id,context_key').eq('context', 'announcement').in('context_key', ids);
      setPolls(new Map(((data || []) as { id: string; context_key: string }[]).map((p) => [p.context_key, p.id])));
    }
  }, [key, ackOn, pollsOn, mediaOn, meId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void reload(); }, [reload]);
  return { ackOn, pollsOn, mediaOn, acked, polls, media, reload };
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

/** Photos (click opens a full-screen viewer) and videos (played in place) of an announcement. */
export function MediaGallery({ items }: { items: AnnMedia[] }) {
  const imgs = items.filter((m) => m.kind === 'image');
  const [view, setView] = useState<number | null>(null);
  useEffect(() => {
    if (view === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setView(null); } if (e.key === 'ArrowRight') setView((v) => (v === null ? v : (v + 1) % imgs.length)); if (e.key === 'ArrowLeft') setView((v) => (v === null ? v : (v - 1 + imgs.length) % imgs.length)); };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [view, imgs.length]);
  if (!items.length) return null;
  return (
    <>
      <div className={`av-gal${items.length === 1 ? ' n1' : ''}`}>
        {items.map((m) => m.kind === 'video'
          ? <div key={m.id} className="av-it vid"><video src={m.url} controls preload="metadata" playsInline /></div>
          : <button key={m.id} type="button" className="av-it" onClick={() => setView(imgs.findIndex((x) => x.id === m.id))} aria-label="Ampliar foto"><img src={m.url} alt="" loading="lazy" /></button>)}
      </div>
      {view !== null && imgs[view] ? createPortal(
        <div className="av-view" style={{ pointerEvents: 'auto' }} onClick={() => setView(null)} role="dialog" aria-label="Foto do aviso">
          <img src={imgs[view].url} alt="" onClick={(e) => e.stopPropagation()} />
          <button type="button" className="x" aria-label="Fechar" onClick={() => setView(null)}><X size={20} /></button>
          {imgs.length > 1 ? <>
            <button type="button" className="pv" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setView((view - 1 + imgs.length) % imgs.length); }}><ChevronLeft size={22} /></button>
            <button type="button" className="nx" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setView((view + 1) % imgs.length); }}><ChevronRight size={22} /></button>
            <span className="ct">{view + 1} de {imgs.length}</span>
          </> : null}
        </div>, document.body) : null}
    </>
  );
}

/** Form field: photos/videos already in the announcement (removable) + new files to send after saving. */
export function MediaPicker({ existing, onRemoveExisting, files, onFiles }: { existing: AnnMedia[]; onRemoveExisting: (m: AnnMedia) => void; files: File[]; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const total = existing.length + files.length;
  // problems are shown right under the picker (a toast can be hidden behind the phone's sheet)
  const add = (list: FileList | null) => {
    const next = [...files]; const probs: string[] = [];
    for (const f of Array.from(list || [])) {
      if (existing.length + next.length >= MEDIA_MAX_FILES) { probs.push(`Até ${MEDIA_MAX_FILES} fotos ou vídeos por aviso.`); break; }
      const p = mediaProblem(f); if (p) { probs.push(p); continue; }
      next.push(f);
    }
    setErr(probs.join(' '));
    onFiles(next);
  };
  const isVideo = (f: File) => mediaType(f).startsWith('video/');
  return (
    <div className="av-pick">
      {existing.map((m) => (
        <div key={m.id} className="av-th">
          {m.kind === 'video' ? <video src={m.url} muted preload="metadata" /> : <img src={m.url} alt="" />}
          {m.kind === 'video' ? <span className="vb">Vídeo</span> : null}
          <button type="button" className="rm" aria-label="Remover" onClick={() => onRemoveExisting(m)}><X size={13} /></button>
        </div>
      ))}
      {files.map((f, i) => (
        <div key={i} className="av-th">
          {isVideo(f) ? <video src={previews[i]} muted playsInline preload="metadata" /> : <img src={previews[i]} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />}
          {isVideo(f) ? <span className="vb">Vídeo</span> : <span className="vb">Foto</span>}
          <button type="button" className="rm" aria-label="Remover" onClick={() => onFiles(files.filter((_, j) => j !== i))}><X size={13} /></button>
        </div>
      ))}
      {total < MEDIA_MAX_FILES ? (
        <button type="button" className="av-add" onClick={() => ref.current?.click()}><ImagePlus size={20} />Foto ou vídeo</button>
      ) : null}
      <input ref={ref} type="file" accept={mediaAccept()} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {err ? <p className="av-err" role="alert">{err}</p> : null}
    </div>
  );
}

const PRI: Record<string, [string, string]> = { normal: ['Geral', ''], important: ['Importante', 'av-important'], urgent: ['Urgente', 'av-urgent'] };
const ACC: Record<string, string> = { important: '#d97706', urgent: '#dc2626' };
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/** Full announcement for reading, in the same look as the Avisos screen: type/pin/obligation tags, author, date,
 *  audience and validity, the text, photos/videos, the poll and the "Li e concordo" confirmation. */
export function AnnouncementDetailDialog({ a, open, onOpenChange, pollId, ackedAt, onAcked, audience, media = [] }: { a: any | null; open: boolean; onOpenChange: (o: boolean) => void; pollId?: string; ackedAt?: string; onAcked: () => void; audience: string; media?: AnnMedia[] }) {
  const [busy, setBusy] = useState(false);
  if (!a) return null;
  const confirm = async () => {
    setBusy(true);
    try { await ackAnnouncement(a.id); toast.success('Leitura confirmada'); onAcked(); }
    catch { toast.error('Não foi possível confirmar a leitura.'); }
    finally { setBusy(false); }
  };
  const [pl, pc] = PRI[a.priority] || PRI.normal;
  const author = a.author?.display_name || a.author?.name || '';
  const ini = author.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const until = a.expire_at ? `Até ${fmt(a.expire_at)}` : 'Sem data de término';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="av-dlg" onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.('.av-view')) e.preventDefault(); }}>
        <div className="av-top" style={{ ['--av-acc' as string]: ACC[a.priority] || 'hsl(var(--primary))' }}>
          <div className="av-tags">
            <span className={`av-tag ${pc}`}>{pl}</span>
            {a.is_pinned ? <span className="av-tag av-pri"><Pin />Fixado</span> : null}
            {a.require_ack ? <span className="av-tag av-pri"><ShieldCheck />Leitura obrigatória</span> : null}
            {pollId ? <span className="av-tag"><BarChart3 />Enquete</span> : null}
            {media.length ? <span className="av-tag"><Images />{media.length} {media.length === 1 ? 'anexo' : 'anexos'}</span> : null}
          </div>
          <DialogTitle className="av-title">{a.title}</DialogTitle>
          <DialogDescription asChild>
            <div className="av-meta">
              {author ? <span>{a.author?.avatar_url ? <img className="av-av" src={a.author.avatar_url} alt="" /> : <span className="av-av">{ini}</span>}{author}</span> : null}
              <span><Clock />{fmt(a.start_at || a.created_at)}</span>
              <span><Users />{audience}</span>
              <span><CalendarClock />{until}</span>
            </div>
          </DialogDescription>
        </div>
        <div className="av-body">
          <div className="av-text">{String(a.content || '').split('\n').map((l: string, i: number) => <p key={i}>{formatText(l, false)}</p>)}</div>
          <MediaGallery items={media} />
          {pollId ? <div className="av-sec"><div className="av-sec-h"><BarChart3 />Enquete</div><PollCard id={pollId} /></div> : null}
        </div>
        {a.require_ack ? (
          <div className="av-foot">
            {ackedAt
              ? <div className="av-ok"><CheckCircle2 />Você confirmou a leitura em {new Date(ackedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.</div>
              : <Button onClick={() => void confirm()} disabled={busy} className="w-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Li e concordo</Button>}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
