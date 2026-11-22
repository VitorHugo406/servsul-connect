// Reuniões 1:1: the manager schedules (the person is notified), both add topics to the agenda before the meeting,
// write shared notes and action items, and each one keeps private notes only they see. History per person.
// one_on_ones + one_on_one_private_notes (migration 20261121010000).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, DoorOpen, ExternalLink, Link2, Loader2, Lock, MapPin, Plus, Trash2, Video } from 'lucide-react';
import { MeetingWherePicker, applyWhere, emptyWhere, providerOf, whereFromEvent, whereProblem, useWhereOptions, type Where } from '@/components/meetings/MeetingWhere';
import { openVideoCall } from '@/components/video/VideoCallHost';
import { useDbColumn } from '@/hooks/useDbFeature';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { appConfirm } from '@/lib/appDialog';
import { Av, db, fmtDH, pname, usePeople } from './rhShared';
import '@/styles/chat-extras.css';

type Item = { id: string; text: string; by?: string; done?: boolean; owner?: string | null };
type O = { id: string; manager_id: string; employee_id: string; scheduled_at: string; status: 'scheduled' | 'done' | 'cancelled'; agenda: Item[]; shared_notes: string | null; action_items: Item[]; event_id?: string | null; duration_min?: number };
type Ev = { id: string; title: string; video_room: string | null; meeting_link: string | null; location: string | null; booking_id: string | null };
const rid = () => Math.random().toString(36).slice(2, 9);
const DUR = [15, 30, 45, 60, 90];
const localInput = (d: Date) => new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
type Draft = { who: string; when: string; dur: number; where: Where };

/** "Onde" of a 1:1, from its calendar meeting. */
function WhereLine({ ev }: { ev?: Ev }) {
  if (!ev) return null;
  if (ev.video_room) return <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />Chamada pelo ewvon</span>;
  if (ev.meeting_link) return <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{providerOf(ev.meeting_link)}</span>;
  if (ev.location) return <span className="inline-flex items-center gap-1">{ev.booking_id ? <DoorOpen className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}{ev.location}</span>;
  return null;
}
/** "Entrar na chamada" / "Abrir link" for a 1:1 that is online. */
function JoinButton({ ev, title }: { ev?: Ev; title: string }) {
  if (ev?.video_room) return <button type="button" className="dk-btn pri" onClick={(e) => { e.stopPropagation(); openVideoCall(ev.id, title); }}><Video size={15} />Entrar na chamada</button>;
  if (ev?.meeting_link) return <a className="dk-btn pri" href={ev.meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink size={15} />Entrar na reunião</a>;
  return null;
}

export function OneOnOnesTab({ isManager }: { isManager: boolean }) {
  const { profile, user, isAdmin } = useAuth();
  const { list: people, byId } = usePeople();
  const whereOpts = useWhereOptions();
  const whereOn = useDbColumn('one_on_ones', 'event_id');
  const [rows, setRows] = useState<O[] | null>(null);
  const [evs, setEvs] = useState<Map<string, Ev>>(new Map());
  const [open, setOpen] = useState<O | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await db.from('one_on_ones').select('*').order('scheduled_at', { ascending: false }).limit(200);
    const list = (data || []) as O[]; setRows(list);
    const ids = list.map((r) => r.event_id).filter(Boolean) as string[];
    if (ids.length) { const { data: e } = await db.from('calendar_events').select('id,title,video_room,meeting_link,location,booking_id').in('id', ids); setEvs(new Map(((e || []) as Ev[]).map((x) => [x.id, x]))); }
    else setEvs(new Map());
  }, []);
  useEffect(() => { void load(); }, [load]);
  const now = Date.now();
  const upcoming = (rows || []).filter((r) => r.status === 'scheduled' && +new Date(r.scheduled_at) >= now - 3 * 36e5).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const past = (rows || []).filter((r) => !upcoming.includes(r));
  const other = (r: O) => byId.get(r.manager_id === profile?.id ? r.employee_id : r.manager_id);
  const canDelete = (r: O) => r.manager_id === profile?.id || isAdmin;

  const newDraft = (base?: Partial<Draft>) => { const d = new Date(Date.now() + 864e5); d.setHours(10, 0, 0, 0); setDraft({ who: '', when: localInput(d), dur: 30, where: emptyWhere(whereOpts.video ? 'ewvon' : 'link'), ...base }); };
  /** "Marcar próxima": same person, same place, two weeks after this one at the same time. */
  const nextOf = async (o: O) => {
    const ev = o.event_id ? evs.get(o.event_id) : undefined;
    let where = ev ? whereFromEvent(ev) : emptyWhere(whereOpts.video ? 'ewvon' : 'link');
    if (ev?.booking_id) { const { data } = await db.from('meeting_bookings').select('room_id').eq('id', ev.booking_id).maybeSingle(); where = { ...where, roomId: data?.room_id || '' }; }
    const d = new Date(o.scheduled_at); d.setDate(d.getDate() + 14);
    setOpen(null); newDraft({ who: o.employee_id, when: localInput(d), dur: o.duration_min || 30, where });
  };

  const schedule = async () => {
    if (!draft || !draft.who || !draft.when || !profile || !user) return;
    const p = whereOn ? whereProblem(draft.where) : null; if (p) { toast.error(p); return; }
    const start = new Date(draft.when); const end = new Date(+start + draft.dur * 60000);
    setBusy(true);
    let eventId: string | null = null;
    if (whereOn) {
      // the 1:1 becomes a meeting in both calendars, with the call, the link, the booked room or the place
      const title = `1:1 · ${pname(byId.get(profile.id))} e ${pname(byId.get(draft.who))}`;
      const { data: ev, error: e1 } = await db.from('calendar_events').insert({ title, description: 'Reunião 1:1. Os assuntos ficam na pauta em RH › 1:1.', event_type: 'meeting', start_date: start.toISOString(), end_date: end.toISOString(), all_day: false, color: '#3B82F6', created_by: user.id }).select('id').single();
      if (e1 || !ev) { setBusy(false); toast.error('Não foi possível criar a reunião no calendário.'); return; }
      eventId = ev.id;
      await db.from('meeting_participants').insert({ event_id: eventId, profile_id: draft.who });
      const err = await applyWhere(eventId!, draft.where, { title, start: start.toISOString(), end: end.toISOString(), participants: [draft.who], profileId: profile.id, companyId: profile.company_id, roomName: whereOpts.rooms.find((r) => r.id === draft.where.roomId)?.name });
      if (err) { await db.from('calendar_events').delete().eq('id', eventId); setBusy(false); toast.error(err); return; }
    }
    const { error } = await db.from('one_on_ones').insert({ manager_id: profile.id, employee_id: draft.who, scheduled_at: start.toISOString(), ...(whereOn ? { event_id: eventId, duration_min: draft.dur } : {}) });
    setBusy(false);
    if (error) { if (eventId) await db.from('calendar_events').delete().eq('id', eventId); toast.error('Você só pode marcar 1:1 com pessoas que você gerencia (equipe ou setor).'); return; }
    toast.success(whereOn ? '1:1 marcada e colocada no calendário. A pessoa foi avisada.' : '1:1 marcada. A pessoa foi avisada.'); setDraft(null); void load();
  };
  const remove = async (r: O) => {
    if (!(await appConfirm({ title: 'Excluir esta 1:1?', message: 'A pauta, as anotações e a reunião no calendário (e a reserva da sala, se houver) serão apagadas.', confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('one_on_ones').delete().eq('id', r.id);
    if (error) toast.error('Não foi possível excluir.'); else { toast.success('1:1 excluída'); setOpen(null); void load(); }
  };

  const ST: Record<string, [string, string]> = { scheduled: ['Agendada', 'dk-c-a'], done: ['Realizada', 'dk-c-g'], cancelled: ['Cancelada', 'dk-c-n'] };
  const rowEl = (r: O, live: boolean) => { const p = other(r); const [l, c] = ST[r.status]; const ev = r.event_id ? evs.get(r.event_id) : undefined; return (
    <div key={r.id} className="dk-it" style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
      <Av p={p} size={40} />
      <div className="dk-nm"><div className="dk-ti">{pname(p)}</div><div className="dk-su flex flex-wrap items-center gap-x-2">{fmtDH(r.scheduled_at)}{r.duration_min ? ` · ${r.duration_min} min` : ''} · {r.manager_id === profile?.id ? 'você é o(a) gestor(a)' : 'com seu gestor(a)'} · {r.agenda.length} assunto(s) na pauta{ev ? <>{' · '}<WhereLine ev={ev} /></> : null}</div></div>
      {live ? <JoinButton ev={ev} title={ev?.title || '1:1'} /> : null}
      <span className={`dk-chp ${c}`}>{l}</span>
      {canDelete(r) ? <button type="button" className="dk-ic" aria-label="Excluir 1:1" title="Excluir" onClick={(e) => { e.stopPropagation(); void remove(r); }}><Trash2 size={16} /></button> : null}
    </div>); };
  return (
    <div className="flex flex-col">
      <div className="dk-bar"><div className="dk-ti" style={{ fontSize: 15 }}>Próximas 1:1</div>{isManager ? <div className="dk-flt"><button type="button" className="dk-btn pri" onClick={() => newDraft()}><Plus size={16} />Marcar 1:1</button></div> : null}</div>
      {rows === null ? <div className="dk-empty"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : upcoming.length ? upcoming.map((r) => rowEl(r, true)) : <div className="dk-empty">Nenhuma 1:1 marcada.</div>}
      {past.length ? <><div className="dk-gh">Histórico</div>{past.slice(0, 60).map((r) => rowEl(r, false))}</> : null}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o && !busy) setDraft(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Marcar 1:1</DialogTitle><DialogDescription>Vai para o calendário de vocês dois. A pessoa recebe um aviso e pode adicionar assuntos à pauta.</DialogDescription></DialogHeader>
          {draft ? <div className="cx-form">
            <div><label className="cx-l">Com quem</label><Sel className="ui-sel w-full" value={draft.who} onChange={(e) => setDraft({ ...draft, who: e.target.value })} aria-label="Pessoa"><option value="">Escolha a pessoa</option>{people.filter((p) => p.id !== profile?.id).map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</Sel></div>
            <div className="cx-two">
              <div><label className="cx-l" htmlFor="oo-when">Quando</label><Input id="oo-when" type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} /></div>
              {whereOn ? <div><label className="cx-l">Duração</label><Sel className="ui-sel w-full" value={String(draft.dur)} onChange={(e) => setDraft({ ...draft, dur: Number(e.target.value) })} aria-label="Duração">{DUR.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60 === 1 ? '1 hora' : `${m / 60} horas`}`.replace('1.5 horas', '1h30')}</option>)}</Sel></div> : null}
            </div>
            {whereOn ? <div><label className="cx-l">Onde vai ser</label>
              <MeetingWherePicker value={draft.where} onChange={(w) => setDraft({ ...draft, where: w })}
                start={draft.when ? new Date(draft.when).toISOString() : null} end={draft.when ? new Date(+new Date(draft.when) + draft.dur * 60000).toISOString() : null} />
            </div> : null}
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button><Button onClick={() => void schedule()} disabled={busy || !draft?.who || !draft?.when}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Marcar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <OneOnOneDialog o={open} ev={open?.event_id ? evs.get(open.event_id) : undefined} onClose={() => setOpen(null)} onChanged={() => void load()} onDelete={(r) => void remove(r)} onNext={isManager && whereOn ? (r) => void nextOf(r) : undefined} canDelete={open ? canDelete(open) : false} />
    </div>
  );
}

function OneOnOneDialog({ o, ev, onClose, onChanged, onDelete, onNext, canDelete }: { o: O | null; ev?: Ev; onClose: () => void; onChanged: () => void; onDelete: (o: O) => void; onNext?: (o: O) => void; canDelete: boolean }) {
  const { profile } = useAuth();
  const { list: people, byId } = usePeople();
  const [x, setX] = useState<O | null>(null);
  const [priv, setPriv] = useState('');
  const [topic, setTopic] = useState(''); const [act, setAct] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setX(o ? { ...o, agenda: [...(o.agenda || [])], action_items: [...(o.action_items || [])] } : null); setPriv(''); setTopic(''); setAct('');
    if (o) void db.from('one_on_one_private_notes').select('notes').eq('one_on_one_id', o.id).maybeSingle().then(({ data }: any) => setPriv(data?.notes || ''));
  }, [o]);
  const pair = useMemo(() => (x ? [byId.get(x.manager_id), byId.get(x.employee_id)] : []), [x, byId]);
  if (!x) return null;
  const isMgr = x.manager_id === profile?.id;
  const save = async (status?: O['status']) => {
    setBusy(true);
    const { error } = await db.from('one_on_ones').update({ agenda: x.agenda, shared_notes: x.shared_notes || null, action_items: x.action_items, ...(status ? { status } : {}) }).eq('id', x.id);
    const pr = await db.from('one_on_one_private_notes').upsert({ one_on_one_id: x.id, notes: priv || null, updated_at: new Date().toISOString() }, { onConflict: 'one_on_one_id,author_id' });
    setBusy(false);
    if (error || pr.error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(status === 'done' ? '1:1 marcada como realizada' : 'Salvo'); onChanged(); onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>1:1 · {pname(pair[0])} e {pname(pair[1])}</DialogTitle><DialogDescription asChild><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{fmtDH(x.scheduled_at)}{x.duration_min ? ` · ${x.duration_min} min` : ''}</span><WhereLine ev={ev} />{x.status === 'scheduled' ? <JoinButton ev={ev} title={ev?.title || '1:1'} /> : null}</div></DialogDescription></DialogHeader>
        <div className="cx-form max-h-[62vh] overflow-auto pr-1">
          <div>
            <label className="cx-l">Pauta</label>
            <div className="flex flex-col gap-1">{x.agenda.map((it) => <div key={it.id} className="flex items-center gap-2 rounded-[10px] bg-muted/50 px-3 py-1.5 text-sm"><span className="flex-1">{it.text}</span><span className="text-[11px] text-muted-foreground">{pname(byId.get(it.by || ''))}</span><button type="button" className="cx-iconbtn" aria-label="Remover assunto" onClick={() => setX({ ...x, agenda: x.agenda.filter((a) => a.id !== it.id) })}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
            <div className="mt-1.5 flex gap-1.5"><Input value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="Adicionar assunto" onKeyDown={(e) => { if (e.key === 'Enter' && topic.trim()) { setX({ ...x, agenda: [...x.agenda, { id: rid(), text: topic.trim(), by: profile?.id }] }); setTopic(''); } }} /><Button type="button" variant="outline" size="icon" aria-label="Adicionar assunto" disabled={!topic.trim()} onClick={() => { setX({ ...x, agenda: [...x.agenda, { id: rid(), text: topic.trim(), by: profile?.id }] }); setTopic(''); }}><Plus className="h-4 w-4" /></Button></div>
          </div>
          <div><label className="cx-l" htmlFor="oo-notes">Anotações compartilhadas</label><Textarea id="oo-notes" rows={5} value={x.shared_notes || ''} onChange={(e) => setX({ ...x, shared_notes: e.target.value })} placeholder="O que conversaram" /></div>
          <div>
            <label className="cx-l">Combinados</label>
            <div className="flex flex-col gap-1">{x.action_items.map((it) => <div key={it.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!it.done} onChange={(e) => setX({ ...x, action_items: x.action_items.map((a) => (a.id === it.id ? { ...a, done: e.target.checked } : a)) })} aria-label="Concluído" />
              <span className={`flex-1 ${it.done ? 'text-muted-foreground line-through' : ''}`}>{it.text}</span>
              <Sel className="ui-sel" value={it.owner || ''} onChange={(e) => setX({ ...x, action_items: x.action_items.map((a) => (a.id === it.id ? { ...a, owner: e.target.value || null } : a)) })} aria-label="Responsável"><option value="">Responsável</option>{people.filter((p) => p.id === x.manager_id || p.id === x.employee_id).map((p) => <option key={p.id} value={p.id}>{pname(p)}</option>)}</Sel>
              <button type="button" className="cx-iconbtn" aria-label="Remover" onClick={() => setX({ ...x, action_items: x.action_items.filter((a) => a.id !== it.id) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>)}</div>
            <div className="mt-1.5 flex gap-1.5"><Input value={act} maxLength={300} onChange={(e) => setAct(e.target.value)} placeholder="Adicionar combinado" onKeyDown={(e) => { if (e.key === 'Enter' && act.trim()) { setX({ ...x, action_items: [...x.action_items, { id: rid(), text: act.trim(), owner: null, done: false }] }); setAct(''); } }} /><Button type="button" variant="outline" size="icon" aria-label="Adicionar combinado" disabled={!act.trim()} onClick={() => { setX({ ...x, action_items: [...x.action_items, { id: rid(), text: act.trim(), owner: null, done: false }] }); setAct(''); }}><Plus className="h-4 w-4" /></Button></div>
          </div>
          <div><label className="cx-l" htmlFor="oo-priv"><Lock className="mr-1 inline h-3.5 w-3.5" />Minhas anotações privadas</label><Textarea id="oo-priv" rows={3} value={priv} onChange={(e) => setPriv(e.target.value)} placeholder="Só você vê" /></div>
        </div>
        <DialogFooter>
          {canDelete ? <Button variant="outline" onClick={() => onDelete(x)} disabled={busy}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
          {isMgr && onNext ? <Button variant="outline" onClick={() => onNext(x)} disabled={busy}><CalendarPlus className="mr-2 h-4 w-4" />Marcar próxima</Button> : null}
          <span className="flex-1" />
          {x.status === 'scheduled' ? <Button variant="outline" onClick={() => void save('done')} disabled={busy}><Check className="mr-2 h-4 w-4" />Marcar como realizada</Button> : null}
          <Button onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
