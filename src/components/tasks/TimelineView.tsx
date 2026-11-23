// Mural › Linha do tempo (Gantt, desktop). One row per card, grouped by column; the bar goes from start_date (or the
// due day when there is no start) to due_date. Drag the bar to move both dates, drag its edges to change start/end,
// click an empty row to give a card without dates a one-day bar. Dependencies (task_dependencies) are drawn as arrows
// from the end of the blocking card to the start of the blocked one (red when the order is impossible). Zoom: dias /
// semanas. Changes use the same onUpdate as the Lista (updateTask), War Room-locked cards are read-only.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useBoardExtras } from '@/hooks/useBoardExtras';
import { getCoverDisplay } from '@/components/tasks/taskConstants';
import { SignedStorageImage } from '@/components/common/SignedStorageMedia';

// bar colour = the card's cover (colour or photo); without a cover, the column colour
const COVER_HEX: Record<string, string> = { 'bg-blue-500': '#3b82f6', 'bg-green-500': '#22c55e', 'bg-yellow-500': '#eab308', 'bg-red-500': '#ef4444', 'bg-purple-500': '#a855f7', 'bg-pink-500': '#ec4899', 'bg-orange-500': '#f97316' };

type T = { id: string; title: string; status: string; cover_image?: string | null; due_date?: string | null; start_date?: string | null; completed_at?: string | null; assigned_to?: string | null; task_number?: number | null };
type C = { id: string; title: string; color?: string | null; is_conclusion?: boolean | null };
type Upd = { start_date?: string | null; due_date?: string | null };
const DAY = 864e5;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addD = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffD = (a: Date, b: Date) => Math.round((startOf(a).getTime() - startOf(b).getTime()) / DAY);
/** keep the original time of day of a due date (or 18:00), start dates at 09:00 */
const at = (day: Date, old: string | null | undefined, h: number) => { const o = old ? new Date(old) : null; return new Date(day.getFullYear(), day.getMonth(), day.getDate(), o ? o.getHours() : h, o ? o.getMinutes() : 0).toISOString(); };

// Solid bars (owner's request): text in white or dark depending on how light the bar colour is.
const onColor = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#fff';
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? '#111827' : '#fff';
};

export function TimelineView({ tasks, cols, person, onOpen, done, late, isLocked, onUpdate, Av }: {
  tasks: T[]; cols: C[]; person: (id?: string | null) => { name: string; avatar: string | null } | null; onOpen: (t: T) => void;
  done: (t: T) => boolean; late: (t: T) => boolean; isLocked: (t: T) => boolean; onUpdate?: (t: T, u: Upd) => void | Promise<void>;
  Av: (p: { p: { name: string; avatar: string | null } | null; id?: string | null }) => JSX.Element | null;
}) {
  const x = useBoardExtras();
  const [zoom, setZoom] = useState<'day' | 'week'>('day');
  const px = zoom === 'day' ? 34 : 13;
  const [from, setFrom] = useState(() => addD(startOf(new Date()), -7));
  const days = zoom === 'day' ? 56 : 182;
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'l' | 'r'; x0: number; dx: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const today = startOf(new Date());

  const span = (t: T): [Date, Date] | null => {
    if (!t.due_date && !t.start_date) return null;
    const e = startOf(new Date(t.due_date || t.start_date!)); let s = t.start_date ? startOf(new Date(t.start_date)) : e;
    if (s > e) s = e; return [s, e];
  };
  const rows = useMemo(() => {
    const out: ({ kind: 'h'; c: C; n: number } | { kind: 't'; t: T })[] = [];
    for (const c of cols) {
      const list = tasks.filter((t) => t.status === c.id).sort((a, b) => (span(a)?.[0].getTime() ?? 9e15) - (span(b)?.[0].getTime() ?? 9e15));
      out.push({ kind: 'h', c, n: list.length });
      if (!closed.has(c.id)) for (const t of list) out.push({ kind: 't', t });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, cols, closed]);
  const rowIndex = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r, i) => { if (r.kind === 't') m.set(r.t.id, i); }); return m; }, [rows]);
  const RH = 36;

  // live geometry while dragging
  const geo = (t: T) => {
    const sp = span(t); if (!sp) return null;
    let [s, e] = sp;
    if (drag?.id === t.id) {
      const dd = Math.round(drag.dx / px);
      if (drag.mode === 'move') { s = addD(s, dd); e = addD(e, dd); }
      if (drag.mode === 'l') { s = addD(s, dd); if (s > e) s = e; }
      if (drag.mode === 'r') { e = addD(e, dd); if (e < s) e = s; }
    }
    return { s, e, left: diffD(s, from) * px, width: (diffD(e, s) + 1) * px };
  };
  useEffect(() => {
    if (!drag) return;
    const mv = (ev: PointerEvent) => setDrag((d) => (d ? { ...d, dx: ev.clientX - d.x0 } : d));
    const up = () => {
      setDrag((d) => {
        if (d) {
          const t = tasks.find((z) => z.id === d.id); const g = t && geo(t);
          if (t && g && Math.round(d.dx / px) !== 0) {
            const u: Upd = {};
            if (d.mode !== 'r') u.start_date = at(g.s, t.start_date, 9);
            if (d.mode !== 'l') u.due_date = at(g.e, t.due_date, 18);
            if (d.mode === 'move' && !t.start_date) u.start_date = null;
            void onUpdate?.(t, u);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.mode]);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = Math.max(0, diffD(today, from) * px - 120); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const W = days * px;
  const dayList = Array.from({ length: days }, (_, i) => addD(from, i));
  const months: { label: string; left: number; width: number }[] = [];
  for (const d of dayList) { const k = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; const last = months[months.length - 1]; if (last && last.label === k) last.width += px; else months.push({ label: k, left: diffD(d, from) * px, width: px }); }
  const arrows = (x?.deps || []).map((d) => {
    const a = tasks.find((t) => t.id === d.depends_on); const b = tasks.find((t) => t.id === d.task_id);
    const ia = a ? rowIndex.get(a.id) : undefined; const ib = b ? rowIndex.get(b.id) : undefined;
    const ga = a && geo(a); const gb = b && geo(b);
    if (ia === undefined || ib === undefined || !ga || !gb) return null;
    const x1 = ga.left + ga.width; const y1 = ia * RH + RH / 2; const x2 = gb.left; const y2 = ib * RH + RH / 2;
    const bad = gb.s < ga.e;   // the blocked card starts before the blocking one ends
    const mid = Math.max(x1 + 10, Math.min(x2 - 10, x1 + 14));
    return { k: d.task_id + d.depends_on, path: `M${x1},${y1} H${mid} V${y2} H${x2 - 4}`, bad, x2, y2 };
  }).filter(Boolean) as { k: string; path: string; bad: boolean; x2: number; y2: number }[];

  return (
    <>
      <div className="bvx-bar">
        <b>Linha do tempo</b>
        <span className="bvx-mut">Arraste as barras para mudar as datas · puxe as pontas para alongar · clique numa linha vazia para dar datas</span>
        <span className="bvx-sp" />
        <button type="button" className="bvx-btn" onClick={() => { setFrom(addD(today, -7)); requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollLeft = 7 * px - 120; }); }}>Hoje</button>
        <button type="button" className="bvx-btn bvx-ibtn" onClick={() => setFrom(addD(from, zoom === 'day' ? -14 : -56))} aria-label="Voltar"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="bvx-btn bvx-ibtn" onClick={() => setFrom(addD(from, zoom === 'day' ? 14 : 56))} aria-label="Avançar"><ChevronRight className="h-4 w-4" /></button>
        <div className="tl-seg">{(['day', 'week'] as const).map((z) => <button key={z} type="button" className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>{z === 'day' ? 'Dias' : 'Semanas'}</button>)}</div>
      </div>
      <div className="tl-wrap" ref={scroller}>
        <div className="tl-left">
          <div className="tl-lh">Card</div>
          {rows.map((r) => r.kind === 'h' ? (
            <button key={'h' + r.c.id} type="button" className="tl-gh" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(r.c.id)) n.delete(r.c.id); else n.add(r.c.id); return n; })}>
              {closed.has(r.c.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}<span className="tl-dot" style={{ background: r.c.color || '#8b93a7' }} />{r.c.title}<span className="bvx-n">{r.n}</span>
            </button>
          ) : (
            <button key={r.t.id} type="button" className={`tl-lr ${done(r.t) ? 'done' : ''}`} onClick={() => onOpen(r.t)} title={r.t.title}>
              <span className="bvx-num">#{r.t.task_number}</span><span className="tl-tt">{r.t.title}</span>
              {x?.blockersOf(r.t.id).length ? <Lock className="h-3 w-3 flex-none text-amber-600" /> : null}
              <Av p={person(r.t.assigned_to)} id={r.t.assigned_to} />
            </button>))}
        </div>
        <div className="tl-right">
          <div style={{ width: W, position: 'relative' }}>
            <div className="tl-head">
              <div className="tl-months">{months.map((m) => <span key={m.label} style={{ left: m.left, width: m.width }}>{m.label}</span>)}</div>
              <div className="tl-days">{dayList.map((d, i) => (zoom === 'day' || d.getDay() === 1) ? <span key={i} className={diffD(d, today) === 0 ? 'today' : ''} style={{ left: i * px, width: zoom === 'day' ? px : px * 7 }}>{zoom === 'day' ? d.getDate() : `${d.getDate()}/${d.getMonth() + 1}`}</span> : null)}</div>
            </div>
            <div className="tl-body" style={{ height: rows.length * RH }}>
              {dayList.map((d, i) => (d.getDay() === 0 || d.getDay() === 6) ? <div key={i} className="tl-we" style={{ left: i * px, width: px }} /> : null)}
              {diffD(today, from) >= 0 && diffD(today, from) < days ? <div className="tl-now" style={{ left: diffD(today, from) * px + px / 2 }} /> : null}
              {rows.map((r, i) => r.kind === 'h' ? <div key={'g' + i} className="tl-grow" style={{ top: i * RH }} /> : (
                <div key={r.t.id} className="tl-row" style={{ top: i * RH }}
                  onClick={(e) => { if (span(r.t) || isLocked(r.t) || !onUpdate) return; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const day = addD(from, Math.floor((e.clientX - rect.left) / px)); void onUpdate(r.t, { start_date: at(day, null, 9), due_date: at(day, null, 18) }); }}>
                  {(() => { const g = geo(r.t); if (!g) return <span className="tl-hint">clique para definir datas</span>; const c = cols.find((z) => z.id === r.t.status); const cv = getCoverDisplay(r.t.cover_image || null); const img = cv.type === 'image' ? cv.value : null; const color = (cv.type === 'color' && COVER_HEX[cv.value]) || c?.color || '#2f6fed'; const lk = isLocked(r.t) || !onUpdate; const st = late(r.t) ? 'late' : done(r.t) ? 'done' : '';
                    return (
                      <div className={`tl-bar ${st} ${img ? 'img' : ''} ${drag?.id === r.t.id ? 'drag' : ''}`} style={{ left: g.left, width: Math.max(g.width, px), background: color, borderColor: color }}
                        onPointerDown={(e) => { if (lk || (e.target as HTMLElement).dataset.edge) return; e.preventDefault(); setDrag({ id: r.t.id, mode: 'move', x0: e.clientX, dx: 0 }); }}
                        onClick={(e) => { e.stopPropagation(); if (!drag) onOpen(r.t); }} title={`${r.t.title} · ${g.s.toLocaleDateString('pt-BR')} → ${g.e.toLocaleDateString('pt-BR')}`}>
                        {img ? <span className="tl-img" aria-hidden="true"><SignedStorageImage url={img} alt="" className="h-full w-full object-cover" /></span> : null}
                        {!lk ? <span className="tl-edge l" data-edge="1" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ id: r.t.id, mode: 'l', x0: e.clientX, dx: 0 }); }} /> : null}
                        {g.width >= 90 ? <span className="tl-bt" style={{ color: img ? '#fff' : onColor(color) }}>{r.t.title}</span> : <span className="tl-bt" />}
                        {g.width < 90 ? <span className="tl-out">{r.t.title}</span> : null}
                        {!lk ? <span className="tl-edge r" data-edge="1" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ id: r.t.id, mode: 'r', x0: e.clientX, dx: 0 }); }} /> : null}
                      </div>); })()}
                </div>))}
              <svg className="tl-svg" width={W} height={rows.length * RH}>
                <defs><marker id="tlA" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8b93a7" /></marker>
                  <marker id="tlB" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e5484d" /></marker></defs>
                {arrows.map((a) => <path key={a.k} d={a.path} fill="none" stroke={a.bad ? '#e5484d' : '#8b93a7'} strokeWidth="1.5" markerEnd={`url(#${a.bad ? 'tlB' : 'tlA'})`} />)}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
