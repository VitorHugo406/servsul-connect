// Chat "+" › Evento/Reunião and Localização (PC and mobile app). Cards: EventCard (invitation with Vou / Não vou,
// join/open link) and LocationCard (mini-map + caption; opens Google Maps, Waze or any map app on the phone).
// Forms (EventForm, LocationPicker) are plain markup so the same code runs in the PC dialogs and the mobile sheets.
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Loader2, LocateFixed, MapPin, PenLine, Search, Video, X, Link2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { planHasFeature } from '@/lib/planAccess';
import { openVideoCall } from '@/components/video/VideoCallHost';
import {
  type ChatLoc, type ChatTransit, type EventDraft, type TransitKind, type TransitLine, BR_UF, ensureTransitState, findTransitLines, TRANSIT_COLORS, TRANSIT_KINDS, TRANSIT_STATUS, fmtEventWhen, isNativeApp, mapLinks, mapTiles, myPosition, reversePlace, searchPlaces,
} from '@/lib/chatShare';
import { Sel } from '@/components/ui/Sel';
import '@/styles/chat-extras.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export type SharePerson = { id: string; name: string; photo?: string | null };

/* ================================================================= mini-map */
export function MiniMap({ lat, lng, w = 280, h = 150, z = 16 }: { lat: number; lng: number; w?: number; h?: number; z?: number }) {
  const tiles = useMemo(() => mapTiles(lat, lng, z, w, h), [lat, lng, z, w, h]);
  return (
    <div className="cx-map" style={{ width: '100%', maxWidth: w, height: h }}>
      <div className="cx-map-in" style={{ width: w, height: h }}>
        {tiles.map((t) => <img key={t.src} src={t.src} alt="" draggable={false} loading="lazy" style={{ left: t.left, top: t.top }} />)}
      </div>
      <span className="cx-pin"><MapPin /></span>
      <span className="cx-attr">© OpenStreetMap</span>
    </div>
  );
}

/* ================================================================= location card */
export function LocationCard({ loc }: { loc: ChatLoc }) {
  const L = mapLinks(loc);
  // Tapping the map: on a phone the system offers every installed map app (geo: link; the Android app always shows
  // the chooser), on iPhone Apple Maps, on the PC Google Maps in a new tab.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod/.test(ua);
  const phone = isNativeApp() || /Android/i.test(ua);
  const href = ios ? `https://maps.apple.com/?q=${encodeURIComponent(loc.name || 'Local')}&ll=${loc.lat},${loc.lng}` : phone ? L.geo : L.google;
  return (
    <div className="cx-loc">
      <a className="cx-loc-map" href={href} target={phone ? undefined : '_blank'} rel="noopener noreferrer" aria-label={`Abrir ${loc.name || 'local'} em um app de mapas`}>
        <MiniMap lat={loc.lat} lng={loc.lng} />
      </a>
      <div className="cx-loc-body">
        <b>{loc.name || 'Localização'}</b>
        {loc.addr && loc.addr !== loc.name ? <small>{loc.addr}</small> : null}
        {loc.cap ? <p className="cx-loc-cap">{loc.cap}</p> : null}
      </div>
    </div>
  );
}

/* ================================================================= event card */
type EvRow = { id: string; title: string; start_date: string; end_date: string | null; all_day: boolean; location?: string | null; meeting_link: string | null; video_room?: string | null; event_type: string; created_by: string; description: string | null };
type PartRow = { profile_id: string; status: string };

export function EventCard({ id }: { id: string }) {
  const { profile, user } = useAuth();
  const [ev, setEv] = useState<EvRow | null | 'gone'>(null);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [{ data: e }, { data: p }] = await Promise.all([
      db.from('calendar_events').select('id,title,start_date,end_date,all_day,location,meeting_link,video_room,event_type,created_by,description').eq('id', id).maybeSingle(),
      db.from('meeting_participants').select('profile_id,status').eq('event_id', id),
    ]);
    setEv(e || 'gone'); setParts(p || []);
  };
  useEffect(() => {
    void load();
    const ch = supabase.channel(`evcard-${id}-${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants', filter: `event_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (ev === null) return <div className="cx-ev"><div className="cx-ev-load"><Loader2 className="h-4 w-4 animate-spin" />Carregando evento…</div></div>;
  if (ev === 'gone') return <div className="cx-ev"><div className="cx-ev-load"><CalendarDays className="h-4 w-4" />Evento cancelado ou indisponível</div></div>;
  const mine = parts.find((p) => p.profile_id === profile?.id);
  const isOwner = ev.created_by === user?.id;
  const yes = parts.filter((p) => p.status === 'accepted').length + 1;   // the organizer goes
  const no = parts.filter((p) => p.status === 'declined').length;
  const wait = parts.filter((p) => p.status === 'pending').length;
  const start = new Date(ev.start_date).getTime(), end = ev.end_date ? new Date(ev.end_date).getTime() : start + 3600_000;
  const now = Date.now(), past = now > end, live = now >= start - 15 * 60_000 && now <= end;
  const answer = async (status: 'accepted' | 'declined') => {
    if (!profile || busy) return;
    setBusy(true);
    await db.from('meeting_participants').update({ status, responded_at: new Date().toISOString() }).eq('event_id', id).eq('profile_id', profile.id);
    await load(); setBusy(false);
  };
  const d = new Date(ev.start_date);
  return (
    <div className={'cx-ev' + (past ? ' is-past' : '')}>
      <div className="cx-ev-top">
        <div className="cx-ev-date"><small>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small><b>{d.getDate()}</b></div>
        <div className="cx-ev-main">
          <span className="cx-ev-kind">{ev.event_type === 'meeting' ? 'Reunião' : 'Evento'}{past ? ' · encerrado' : live ? ' · agora' : ''}</span>
          <b className="cx-ev-title">{ev.title}</b>
          <small>{fmtEventWhen(ev.start_date, ev.end_date, ev.all_day)}</small>
        </div>
      </div>
      {ev.video_room ? <div className="cx-ev-where"><Video className="h-3.5 w-3.5" />Chamada pelo ewvon</div>
        : ev.meeting_link ? <div className="cx-ev-where"><Link2 className="h-3.5 w-3.5" />{(() => { try { return new URL(ev.meeting_link).host; } catch { return 'Link'; } })()}</div>
        : ev.location ? <a className="cx-ev-where" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" />{ev.location}</a> : null}
      {ev.description ? <p className="cx-ev-desc">{ev.description}</p> : null}
      <div className="cx-ev-count">{yes} {yes === 1 ? 'vai' : 'vão'}{no ? ` · ${no} não ${no === 1 ? 'vai' : 'vão'}` : ''}{wait ? ` · ${wait} sem resposta` : ''}</div>
      <div className="cx-ev-acts">
        {mine && !past ? <>
          <button type="button" className={'cx-ev-btn' + (mine.status === 'accepted' ? ' on' : '')} disabled={busy} onClick={() => void answer('accepted')}><Check className="h-3.5 w-3.5" />Vou</button>
          <button type="button" className={'cx-ev-btn' + (mine.status === 'declined' ? ' on no' : '')} disabled={busy} onClick={() => void answer('declined')}><X className="h-3.5 w-3.5" />Não vou</button>
        </> : isOwner && !past ? <span className="cx-ev-note">Você organizou</span> : null}
        {ev.video_room && live ? <button type="button" className="cx-ev-btn pri" onClick={() => openVideoCall(ev.id, ev.title)}><Video className="h-3.5 w-3.5" />Entrar</button> : null}
        {ev.meeting_link && !past ? <a className="cx-ev-btn pri" href={ev.meeting_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Abrir link</a> : null}
      </div>
    </div>
  );
}

/* ================================================================= event form */
export function EventForm({ value: d, onChange, people, mobile }: { value: EventDraft; onChange: (d: EventDraft) => void; people: SharePerson[]; mobile?: boolean }) {
  const { plan } = useCompanyPlan();
  const video = !!plan && planHasFeature(plan, 'video_calls');
  const [q, setQ] = useState('');
  const set = (p: Partial<EventDraft>) => onChange({ ...d, ...p });
  const inp = mobile ? 'fld' : 'cx-in';
  const list = people.filter((p) => !q.trim() || p.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(q.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')));
  const wheres: [EventDraft['where'], string][] = [...(video ? [['call', 'Chamada ewvon'] as [EventDraft['where'], string]] : []), ['local', 'Local'], ['link', 'Link'], ['none', 'Sem local']];
  useEffect(() => { if (d.where === 'call' && plan && !video) set({ where: 'local' }); /* plan without video calls */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video, plan]);
  return (
    <div className={'cx-evf' + (mobile ? ' is-m' : '')}>
      <div className="cx-seg" role="radiogroup" aria-label="Tipo">
        {(['meeting', 'event'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={d.kind === k} className={d.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>{k === 'meeting' ? 'Reunião' : 'Evento'}</button>)}
      </div>
      <label className="cx-lbl">Título</label>
      <input className={inp} value={d.title} maxLength={200} placeholder={d.kind === 'meeting' ? 'Ex.: Alinhamento semanal' : 'Ex.: Confraternização de fim de ano'} onChange={(e) => set({ title: e.target.value })} />
      <div className="cx-row3">
        <div><label className="cx-lbl">Data</label><input className={inp} type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} /></div>
        {!d.allDay ? <>
          <div><label className="cx-lbl">Início</label><input className={inp} type="time" value={d.start} onChange={(e) => set({ start: e.target.value })} /></div>
          <div><label className="cx-lbl">Fim</label><input className={inp} type="time" value={d.end} onChange={(e) => set({ end: e.target.value })} /></div>
        </> : null}
      </div>
      <label className="cx-check"><input type="checkbox" checked={d.allDay} onChange={(e) => set({ allDay: e.target.checked })} /><span />Dia todo</label>
      <label className="cx-lbl">Onde</label>
      <div className="cx-seg sm">
        {wheres.map(([k, t]) => <button key={k} type="button" className={d.where === k ? 'on' : ''} onClick={() => set({ where: k })}>{t}</button>)}
      </div>
      {d.where === 'local' ? <input className={inp} value={d.place} maxLength={300} placeholder="Endereço ou sala (ex.: Av. Paulista, 1000 — 5º andar)" onChange={(e) => set({ place: e.target.value })} /> : null}
      {d.where === 'link' ? <input className={inp} value={d.link} inputMode="url" placeholder="https://…" onChange={(e) => set({ link: e.target.value })} /> : null}
      {d.where === 'call' ? <p className="cx-hint">Na hora, todos entram pelo botão “Entrar” do convite, sem sair do ewvon.</p> : null}
      <label className="cx-lbl">Lembrete</label>
      <div className="cx-seg sm">
        {[[0, 'Nenhum'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h']].map(([m, t]) => <button key={m} type="button" className={d.reminder === m ? 'on' : ''} onClick={() => set({ reminder: m as number })}>{t}</button>)}
      </div>
      <label className="cx-lbl">Descrição (opcional)</label>
      <textarea className={inp} rows={2} value={d.description} maxLength={2000} placeholder="Pauta, o que levar, observações…" onChange={(e) => set({ description: e.target.value })} />
      <label className="cx-lbl">Convidados <span>{d.participants.length} selecionado{d.participants.length === 1 ? '' : 's'}</span></label>
      {people.length > 6 ? <input className={inp} value={q} placeholder="Buscar pessoa" onChange={(e) => setQ(e.target.value)} /> : null}
      <div className="cx-ppl">
        {list.map((p) => {
          const on = d.participants.includes(p.id);
          return (
            <button key={p.id} type="button" className={'cx-ppl-i' + (on ? ' on' : '')} onClick={() => set({ participants: on ? d.participants.filter((x) => x !== p.id) : [...d.participants, p.id] })}>
              <span className="cx-av" style={p.photo ? { backgroundImage: `url("${p.photo}")` } : undefined}>{p.photo ? '' : p.name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}</span>
              <span className="cx-ppl-n">{p.name}</span>
              <span className="cx-tick">{on ? <Check className="h-3.5 w-3.5" /> : null}</span>
            </button>
          );
        })}
        {!list.length ? <p className="cx-hint">Ninguém encontrado.</p> : null}
      </div>
    </div>
  );
}

/* ================================================================= location picker */
export function LocationPicker({ value, onChange, mobile }: { value: ChatLoc | null; onChange: (l: ChatLoc | null) => void; mobile?: boolean }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ChatLoc[] | null>(null);
  const [busy, setBusy] = useState<'' | 'search' | 'me'>('');
  const [err, setErr] = useState('');
  const inp = mobile ? 'fld' : 'cx-in';
  const search = async () => {
    if (q.trim().length < 3 || busy) return;
    setBusy('search'); setErr('');
    try { const r = await searchPlaces(q); setRes(r); if (!r.length) setErr('Nenhum endereço encontrado. Tente com rua, número e cidade.'); }
    catch { setErr('Não foi possível buscar agora. Tente de novo.'); }
    finally { setBusy(''); }
  };
  const mine = async () => {
    setBusy('me'); setErr('');
    try { const p = await myPosition(); const l = await reversePlace(p.lat, p.lng); onChange({ ...l, cap: value?.cap || '' }); setRes(null); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível obter a sua localização.'); }
    finally { setBusy(''); }
  };
  if (value) {
    return (
      <div className={'cx-lp' + (mobile ? ' is-m' : '')}>
        <div className="cx-lp-sel">
          <MiniMap lat={value.lat} lng={value.lng} w={420} h={170} />
          <div className="cx-lp-info"><b>{value.name}</b>{value.addr ? <small>{value.addr}</small> : null}</div>
          <button type="button" className="cx-lp-change" onClick={() => onChange(null)}>Trocar local</button>
        </div>
        <label className="cx-lbl">Legenda (opcional)</label>
        <textarea className={inp} rows={3} maxLength={1000} value={value.cap} placeholder="Ex.: Acidente na pista sentido centro, trânsito parado. Evitem o trecho." onChange={(e) => onChange({ ...value, cap: e.target.value })} />
      </div>
    );
  }
  return (
    <div className={'cx-lp' + (mobile ? ' is-m' : '')}>
      <button type="button" className="cx-lp-me" onClick={() => void mine()} disabled={!!busy}>{busy === 'me' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Usar minha localização atual</button>
      <div className="cx-lp-or"><span>ou busque um endereço</span></div>
      <div className="cx-lp-q">
        <input className={inp} value={q} placeholder="Rua, número, bairro, cidade" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
        <button type="button" className="cx-lp-go" onClick={() => void search()} disabled={!!busy || q.trim().length < 3} aria-label="Buscar endereço">{busy === 'search' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
      </div>
      {err ? <p className="cx-err">{err}</p> : null}
      {res?.length ? <div className="cx-lp-res">
        {res.map((r, i) => <button key={i} type="button" onClick={() => onChange(r)}><MapPin className="h-4 w-4" /><span><b>{r.name}</b><small>{r.addr}</small></span></button>)}
      </div> : null}
      <p className="cx-hint">Endereços: © OpenStreetMap.</p>
    </div>
  );
}

/* ================================================================= transit line (hand-drawn, like the offline screen) */
// Rough pencil frame + track + vehicle; strokes draw themselves in, then the vehicle keeps driving along the line.
// 'down' stops it halfway with a red scribbled X, 'delay' drives slowly, 'full' shows little heads in the windows.
const TR_VEH: Record<TransitKind, string[]> = {
  bus: ['M-26 -4 C -26 -20, -22 -22, -12 -22 L 22 -22 C 27 -22, 28 -18, 28 -10 L 28 6 L -26 6 Z', 'M-20 -16 L -8 -16 L -8 -6 L -20 -6 Z', 'M-3 -16 L 9 -16 L 9 -6 L -3 -6 Z', 'M14 -16 L 24 -16 L 24 -6 L 14 -6 Z', 'M-14 10 c 0 -7 9 -7 9 0 c 0 6 -9 6 -9 0', 'M12 10 c 0 -7 9 -7 9 0 c 0 6 -9 6 -9 0'],
  train: ['M-30 4 L -30 -18 C -30 -24, -26 -26, -18 -26 L 22 -26 C 30 -26, 34 -20, 34 -8 L 34 4 Z', 'M-24 -20 L -12 -20 L -12 -9 L -24 -9 Z', 'M-6 -20 L 6 -20 L 6 -9 L -6 -9 Z', 'M12 -20 L 26 -20 C 28 -16, 29 -12, 29 -9 L 12 -9 Z', 'M-22 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0', 'M18 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0'],
  metro: ['M-28 4 L -28 -22 C -28 -26, -24 -27, -20 -27 L 24 -27 C 28 -27, 30 -25, 30 -21 L 30 4 Z', 'M-22 -21 L -6 -21 L -6 -9 L -22 -9 Z', 'M2 -21 L 24 -21 L 24 -9 L 2 -9 Z', 'M-28 -3 L 30 -3', 'M-20 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0', 'M15 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0'],
  tram: ['M-26 4 L -26 -18 C -26 -22, -22 -24, -16 -24 L 20 -24 C 26 -24, 28 -20, 28 -16 L 28 4 Z', 'M-20 -18 L -6 -18 L -6 -8 L -20 -8 Z', 'M0 -18 L 22 -18 L 22 -8 L 0 -8 Z', 'M-4 -24 L 4 -34 L -6 -40 M 4 -34 L 14 -40', 'M-18 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0', 'M12 9 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0'],
};
const TR_FRAME = 'M8 6 C 90 3, 210 8, 292 5 C 296 40, 293 90, 295 134 C 200 137, 100 132, 6 135 C 4 95, 7 45, 8 6';
const TR_TRACK = 'M24 92 C 80 89, 140 95, 200 91 C 240 89, 262 93, 278 91';
const TR_SLEEPERS = Array.from({ length: 13 }, (_, i) => { const x = 30 + i * 19.5; return `M${x} 87 L ${x - 2} 98`; });

// Handwriting font for the sketch cards (phones have no Comic/Segoe Print), loaded once from Google Fonts.
function useSketchFont() {
  useEffect(() => {
    if (document.getElementById('cx-sketch-font')) return;
    const l = document.createElement('link');
    l.id = 'cx-sketch-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';
    document.head.appendChild(l);
  }, []);
}

export function TransitCard({ t: x }: { t: ChatTransit }) {
  useSketchFont();
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const kindLabel = TRANSIT_KINDS.find((k) => k[0] === x.k)?.[1] || 'Linha';
  const ref = (x.line || '•').slice(0, 9);
  const bw = Math.max(34, ref.length * 9 + 14);   // badge grows with the line number (875A-10, L9, 7…)
  const st = TRANSIT_STATUS.find((s) => s[0] === x.st)?.[1] || 'Normal';
  let k = 0;
  const sketch = (ds: string[], cls = '', extra?: React.SVGProps<SVGPathElement>) => ds.flatMap((d) => [
    <path key={k++} d={d} className={'cx-tr-s ' + cls} pathLength={1} style={{ animationDelay: `${0.1 + Math.min(k, 24) * 0.04}s` }} {...extra} />,
    <path key={k++} d={d} className={'cx-tr-s ghost ' + cls} pathLength={1} transform="translate(1.2 -0.9)" style={{ animationDelay: `${0.1 + Math.min(k, 24) * 0.04}s` }} {...extra} />,
  ]);
  const rail = x.k === 'bus' ? [TR_TRACK] : [TR_TRACK, 'M24 99 C 80 96, 140 102, 200 98 C 240 96, 262 100, 278 98', ...TR_SLEEPERS];
  // station ruler (trains / metro / VLT from the transit table): one dot per station, affected stretch highlighted
  const sts = x.stations || [];
  const n = sts.length;
  const sx = (i: number) => (n > 1 ? 34 + (i * 232) / (n - 1) : 34);
  const hasStretch = n > 1 && x.st !== 'normal' && x.a !== undefined && x.b !== undefined && x.b > x.a;
  const xa = hasStretch ? sx(x.a as number) : 0, xb = hasStretch ? sx(x.b as number) : 0;
  const stretch = hasStretch ? `M${xa} 92 C ${xa + (xb - xa) * 0.3} 90, ${xa + (xb - xa) * 0.7} 94, ${xb} 92` : '';
  const short = (s: string) => (s.length > 18 ? s.slice(0, 17) + '…' : s);
  const stLabel = x.st === 'down' ? 'Parado' : x.st === 'delay' ? 'Lentidão' : 'Lotado';

  return (
    <div className={`cx-tr st-${x.st}`} style={{ ['--trc' as string]: x.color }}>
      <svg className="cx-tr-art" viewBox="0 0 300 140" aria-hidden="true">
        <defs><filter id={`tr-rough-${uid}`}><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" /><feDisplacementMap in="SourceGraphic" scale="2.6" /></filter></defs>
        <g filter={`url(#tr-rough-${uid})`}>
          {sketch([TR_FRAME], 'frame')}
          {n > 1 ? sketch([TR_TRACK], 'line') : sketch(rail, x.k === 'bus' ? 'road' : 'rail')}
          {n > 1 ? sketch(sts.map((_, i) => `M${sx(i) - 3.5} 92 c 0 -5 7 -5 7 0 c 0 5 -7 5 -7 0`), 'stop dot') : sketch(['M30 92 c 0 -6 9 -6 9 0 c 0 6 -9 6 -9 0', 'M262 92 c 0 -6 9 -6 9 0 c 0 6 -9 6 -9 0'], 'stop')}
          {hasStretch ? sketch([stretch], `stretch ${x.st}`) : null}
          <g className="cx-tr-veh" style={hasStretch && x.st === 'down' ? { transform: `translate(${Math.max(40, xa - 30)}px, 84px)`, animation: 'none' } : undefined}><g className="cx-tr-bob"><g transform={n > 1 ? 'translate(0 4) scale(.66)' : undefined}>
            {sketch(TR_VEH[x.k], 'veh')}
            {x.st === 'full' ? sketch(['M-15 -11 c 0 -3 4 -3 4 0', 'M2 -11 c 0 -3 4 -3 4 0', 'M17 -11 c 0 -3 4 -3 4 0'], 'heads') : null}
          </g></g></g>
          {x.st === 'down' ? (hasStretch ? sketch([`M${(xa + xb) / 2 - 8} 98 L ${(xa + xb) / 2 + 8} 112`, `M${(xa + xb) / 2 + 8} 98 L ${(xa + xb) / 2 - 8} 112`], 'red') : sketch(['M140 50 L 166 76', 'M166 50 L 140 76'], 'red')) : null}
          {x.st === 'delay' ? sketch(['M232 30 c -12 0 -12 18 0 18 c 12 0 12 -18 0 -18', 'M232 33 L 232 39 L 237 41'], 'amber') : null}
        </g>
        <text x="22" y="122" className="cx-tr-tx">{short(x.from || 'Origem')}</text>
        <text x="282" y="122" className="cx-tr-tx" textAnchor="end">{short(x.to || 'Destino')}</text>
        {hasStretch ? (() => {
          const label = `${stLabel}: ${short(sts[x.a as number])} → ${short(sts[x.b as number])}`;
          const half = Math.min(130, label.length * 3.1);
          const cx = Math.min(292 - half, Math.max(8 + half, (xa + xb) / 2));
          return <text x={cx} y="63" textAnchor="middle" className={`cx-tr-alert ${x.st}`}>{label}</text>;
        })() : null}
        <g className="cx-tr-badge" transform="translate(34 34)">
          <rect x={-17} y={-15} width={bw} height={30} rx={13} className="cx-tr-bg" />
          <text x={bw / 2 - 17} y="5" textAnchor="middle" className="cx-tr-num">{ref}</text>
        </g>
        <text x={bw + 26} y="30" className="cx-tr-name">{(x.name || `${kindLabel} ${x.line}`).slice(0, 26)}</text>
        <text x={bw + 26} y="47" className="cx-tr-sub">{kindLabel}{x.city ? ` · ${x.city}` : ''}</text>
      </svg>
      <div className="cx-tr-foot"><span className={`cx-tr-st ${x.st}`}>{st}</span></div>
      {x.cap ? <p className="cx-tr-cap">{x.cap}</p> : null}
    </div>
  );
}

export function TransitForm({ value: x, onChange, mobile }: { value: ChatTransit; onChange: (t: ChatTransit) => void; mobile?: boolean }) {
  const set = (p: Partial<ChatTransit>) => onChange({ ...x, ...p });
  const inp = mobile ? 'fld' : 'cx-in';
  const rail = x.k !== 'bus';
  const [uf, setUf] = useState(() => { try { return localStorage.getItem('ewvon:transit-uf') || 'SP'; } catch { return 'SP'; } });
  const [num, setNum] = useState('');
  const [lines, setLines] = useState<TransitLine[] | null>(null);
  const [pick, setPick] = useState<TransitLine | null>(null);
  const [dir, setDir] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [manual, setManual] = useState(false);
  const ufName = BR_UF.find((u) => u[0] === uf)?.[1] || uf;
  const apply = (l: TransitLine, d: number) => {
    const dd = l.dirs[d] || l.dirs[0] || { from: '', to: '' };
    const st = l.stations.length > 1 ? (d === 1 ? [...l.stations].reverse() : l.stations) : [];
    onChange({ ...x, line: l.ref, name: l.name, from: dd.from || st[0] || '', to: dd.to || st[st.length - 1] || '', city: ufName, color: l.color || x.color, stations: st, a: undefined, b: undefined });
  };
  const run = async (ref: string) => {
    setBusy(true); setErr(''); setLines(null); setPick(null);
    try { localStorage.setItem('ewvon:transit-uf', uf); } catch { /* ignore */ }
    try {
      let state = await ensureTransitState(uf);
      for (let i = 0; state === 'loading' && i < 12; i++) { await new Promise((ok) => setTimeout(ok, 5000)); state = await ensureTransitState(uf); }
      if (state === 'error') { setErr('Não foi possível carregar as linhas deste estado agora. Tente de novo em instantes ou preencha manualmente.'); return; }
      if (state === 'loading') { setErr('Ainda carregando as linhas deste estado pela primeira vez. Tente de novo em 1 minuto.'); return; }
      const r = await findTransitLines(uf, ref, x.k);
      setLines(r);
      if (!r.length) setErr(rail ? 'Não há linhas desse tipo cadastradas neste estado. Preencha manualmente.' : 'Não achamos essa linha. Confira o número ou preencha manualmente.');
      else if (r.length === 1) { setPick(r[0]); setDir(0); apply(r[0], 0); }
    } catch { setErr('A busca não respondeu agora. Tente de novo.'); }
    finally { setBusy(false); }
  };
  // trains / metro / VLT: list the state's lines right away (no number to type)
  useEffect(() => { if (rail && !manual) void run(''); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x.k, uf, manual]);
  const ufSel = mobile
    ? <select className="fld" value={uf} onChange={(e) => setUf(e.target.value)}>{BR_UF.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
    : <Sel className="ui-sel cx-sel" value={uf} onChange={(e) => setUf(e.target.value)}>{BR_UF.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Sel>;
  const stations = x.stations || [];
  const stSel = (val: number | undefined, on: (v: number) => void, label: string) => mobile
    ? <select className="fld" value={val ?? ''} onChange={(e) => on(Number(e.target.value))}><option value="" disabled>{label}</option>{stations.map((s, i) => <option key={i} value={i}>{s}</option>)}</select>
    : <Sel className="ui-sel cx-sel" value={val === undefined ? '' : String(val)} onChange={(e) => on(Number(e.target.value))}><option value="" disabled>{label}</option>{stations.map((s, i) => <option key={i} value={String(i)}>{s}</option>)}</Sel>;
  return (
    <div className={'cx-evf' + (mobile ? ' is-m' : '')}>
      <div className="cx-seg sm">{TRANSIT_KINDS.map(([k, t]) => <button key={k} type="button" className={x.k === k ? 'on' : ''} onClick={() => { onChange({ ...x, k, stations: [], a: undefined, b: undefined, line: '', name: '' }); setLines(null); setPick(null); setNum(''); }}>{t}</button>)}</div>
      {!manual ? <>
        {rail ? <><label className="cx-lbl">Estado</label>{ufSel}</> : <div className="cx-row2">
          <div><label className="cx-lbl">Estado</label>{ufSel}</div>
          <div><label className="cx-lbl">Número da linha</label>
            <div className="cx-lp-q">
              <input className={inp} value={num} maxLength={12} placeholder="Ex.: 875A" onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (num.trim()) void run(num); } }} />
              <button type="button" className="cx-lp-go" onClick={() => { if (num.trim()) void run(num); }} disabled={busy || !num.trim()} aria-label="Buscar linha">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>}
        {busy && rail ? <p className="cx-hint"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Carregando as linhas…</p> : null}
        {busy && !rail ? <p className="cx-hint">Buscando… na primeira vez de cada estado pode levar até 1 minuto.</p> : null}
        {err ? <p className="cx-err">{err}</p> : null}
        {lines && lines.length > 1 && !pick ? <div className={rail ? 'cx-tr-lines' : 'cx-lp-res'}>
          {lines.map((l, i) => rail
            ? <button key={i} type="button" className="cx-tr-lb" onClick={() => { setPick(l); setDir(0); apply(l, 0); }}><span className="cx-tr-chip" style={{ background: l.color || '#475569' }}>{l.ref || '•'}</span><span>{l.name || `Linha ${l.ref}`}</span></button>
            : <button key={i} type="button" onClick={() => { setPick(l); setDir(0); apply(l, 0); }}>
              <span className="cx-tr-chip" style={{ background: l.color || x.color }}>{l.ref}</span>
              <span><b>{l.name || `Linha ${l.ref}`}</b><small>{l.dirs[0] ? `${l.dirs[0].from} ⇄ ${l.dirs[0].to}` : l.network}</small></span>
            </button>)}
        </div> : null}
        {pick ? <>
          <div className="cx-tr-picked"><span className="cx-tr-chip" style={{ background: pick.color || x.color }}>{pick.ref || '•'}</span><b>{pick.name || `Linha ${pick.ref}`}</b>{lines && lines.length > 1 ? <button type="button" className="cx-alt sm" onClick={() => { setPick(null); onChange({ ...x, line: '', name: '', stations: [] }); }}>Trocar</button> : null}</div>
          <label className="cx-lbl">Sentido</label>
          <div className="cx-seg">
            {[0, 1].map((d) => <button key={d} type="button" className={dir === d ? 'on' : ''} onClick={() => { setDir(d); apply(pick, d); }}>{d === 0 ? 'Ida' : 'Volta'}{pick.dirs[d]?.to ? ` · ${pick.dirs[d].to}` : ''}</button>)}
          </div>
        </> : null}
      </> : <>
        <div className="cx-row2">
          <div><label className="cx-lbl">Número</label><input className={inp} value={x.line} maxLength={12} placeholder="Ex.: 875A, L9, 7" onChange={(e) => set({ line: e.target.value })} /></div>
          <div><label className="cx-lbl">Nome da linha (opcional)</label><input className={inp} value={x.name} maxLength={80} placeholder="Ex.: Linha Esmeralda" onChange={(e) => set({ name: e.target.value })} /></div>
        </div>
        <div className="cx-row2">
          <div><label className="cx-lbl">De</label><input className={inp} value={x.from} maxLength={80} placeholder="Ex.: Osasco" onChange={(e) => set({ from: e.target.value })} /></div>
          <div><label className="cx-lbl">Para</label><input className={inp} value={x.to} maxLength={80} placeholder="Ex.: Grajaú" onChange={(e) => set({ to: e.target.value })} /></div>
        </div>
        <label className="cx-lbl">Cidade / país (opcional)</label>
        <input className={inp} value={x.city} maxLength={60} placeholder="Ex.: Lisboa, Tóquio" onChange={(e) => set({ city: e.target.value })} />
        <label className="cx-lbl">Cor da linha</label>
        <div className="cx-colors">{TRANSIT_COLORS.map((c) => <span key={c} role="radio" aria-checked={x.color === c} tabIndex={0} className={x.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ color: c })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') set({ color: c }); }} />)}</div>
      </>}
      <button type="button" className="cx-alt" onClick={() => { setManual(!manual); setErr(''); if (!manual) onChange({ ...x, stations: [], a: undefined, b: undefined }); }}>
        {manual ? <><Search className="h-3.5 w-3.5" />Buscar a linha pelo estado</> : <><PenLine className="h-3.5 w-3.5" />Preencher manualmente</>}
      </button>
      <label className="cx-lbl">Situação</label>
      <div className="cx-seg sm">{TRANSIT_STATUS.map(([k, t]) => <button key={k} type="button" className={x.st === k ? 'on' : ''} onClick={() => set({ st: k })}>{t}</button>)}</div>
      {stations.length > 1 && x.st !== 'normal' ? <>
        <label className="cx-lbl">Trecho afetado</label>
        <div className="cx-row2">
          <div>{stSel(x.a, (v) => set({ a: v, b: x.b === undefined || x.b <= v ? Math.min(stations.length - 1, v + 1) : x.b }), 'De estação')}</div>
          <div>{stSel(x.b, (v) => set({ b: v, a: x.a === undefined || x.a >= v ? Math.max(0, v - 1) : x.a }), 'Até estação')}</div>
        </div>
      </> : null}
      <label className="cx-lbl">Legenda (opcional)</label>
      <textarea className={inp} rows={2} maxLength={1000} value={x.cap} placeholder={rail ? 'Ex.: Velocidade reduzida por falha na via.' : 'Ex.: Ônibus atrasado por causa de um acidente na avenida.'} onChange={(e) => set({ cap: e.target.value })} />
      {x.line || x.name ? <><label className="cx-lbl">Prévia</label><TransitCard t={x} /></> : null}
    </div>
  );
}
