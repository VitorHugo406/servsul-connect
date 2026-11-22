// Organograma (RH), drawn like the owner's reference image: the company on top (logo in the round frame + level A
// card), then each sector (level B, photo of its manager — sectors.manager_id), the supervised teams of that sector
// (level C, supervisor photo; a team goes to the sector where most of its members are) and the people (level D, round
// photos with the name below). Built only from existing tables; read-only. Clicking a person opens their profile card.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minus, Plus, Search } from 'lucide-react';
import { useSectors } from '@/hooks/useData';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyLogoUrl } from '@/lib/companyLogo';
import { UserPreviewDialog } from '@/components/user/UserPreviewDialog';
import { db, initials, pname, usePeople, type Person } from './rhShared';
import '@/styles/orgchart.css';

type Team = { id: string; name: string; supervisor_id: string | null };
type TM = { team_id: string | null; member_profile_id: string };
type Sec = { id: string; name: string; color?: string | null; is_general?: boolean | null; manager_id?: string | null };
type N = { key: string; lv: 'A' | 'B' | 'C' | 'D'; title: string; lines: string[]; photo?: string | null; tint?: string; person?: Person; kids: N[]; more?: { parent: string; count: number; less?: boolean } };
const SHOW = 6;          // people shown under each sector/team before "+N"
const MIN_AUTO = 0.6;    // the automatic fit never goes below this (bigger companies scroll/drag instead)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function useOswald() {
  useEffect(() => {
    if (document.getElementById('oc-font')) return;
    const l = document.createElement('link'); l.id = 'oc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&display=swap';
    document.head.appendChild(l);
  }, []);
}

function Photo({ src, label, tint }: { src?: string | null; label: string; tint?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  return <span className="oc-ph" style={!src || bad ? { background: tint || '#bdbdbd' } : undefined}>{src && !bad ? <img src={src} alt="" onError={() => setBad(true)} /> : initials(label) || '?'}</span>;
}

export function OrgChartTab() {
  useOswald();
  const { company } = useCompany();
  const logo = useCompanyLogoUrl(company?.logo_url);
  const { sectors } = useSectors();
  const { list: people } = usePeople();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tms, setTms] = useState<TM[]>([]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [height, setHeight] = useState(560);
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const manual = useRef(false);   // after the person zooms, the chart stops fitting itself
  const drag = useRef<{ x: number; y: number; l: number; t: number; id: number } | null>(null);
  useEffect(() => {
    void Promise.all([db.from('teams').select('id,name,supervisor_id').order('name'), db.from('supervisor_team_members').select('team_id,member_profile_id')])
      .then(([t, m]) => { setTeams((t.data || []) as Team[]); setTms((m.data || []) as TM[]); }).catch(() => undefined);
  }, []);
  // the stage fills the content area down to the bottom of the main panel
  useLayoutEffect(() => {
    const fitH = () => { const el = stage.current; if (!el) return; const main = el.closest('.ewvon-main') as HTMLElement | null; const bottom = main ? main.getBoundingClientRect().bottom : window.innerHeight; setHeight(Math.max(480, Math.round(bottom - el.getBoundingClientRect().top))); };
    fitH(); window.addEventListener('resize', fitH); return () => window.removeEventListener('resize', fitH);
  }, []);

  const f = q.trim().toLowerCase();
  const tree = useMemo<N>(() => {
    const byUser = new Map(people.filter((p) => p.user_id).map((p) => [p.user_id as string, p]));
    const byId = new Map(people.map((p) => [p.id, p]));
    const allSecs = (sectors || []) as unknown as Sec[];
    const known = new Set(allSecs.map((s) => s.id));
    const sectorOf = (p: Person) => (p.sector_id && known.has(p.sector_id) ? p.sector_id : null);
    // sectors drawn = every sector, except a general sector nobody is in; the count in the company card uses the same list
    const secs = allSecs.filter((s) => !s.is_general || !!s.manager_id || people.some((p) => p.sector_id === s.id))
      .sort((x, y) => Number(!!x.is_general) - Number(!!y.is_general));
    // everyone appears ONCE: a manager (level B photo) or a supervisor (level C photo) is not repeated as a person
    // below, and a person in several teams goes under the first one only
    const manager = new Map<string, Person>();
    for (const s of secs) { const m = s.manager_id ? byId.get(s.manager_id) : undefined; if (m) manager.set(s.id, m); }
    const sup = new Map<string, Person>();
    for (const t of teams) { const p = t.supervisor_id ? byUser.get(t.supervisor_id) : undefined; if (p) sup.set(t.id, p); }
    const placed = new Set<string>([...manager.values(), ...sup.values()].map((p) => p.id));
    const rawMembers = new Map<string, Person[]>();
    for (const m of tms) { if (!m.team_id) continue; const p = byId.get(m.member_profile_id); if (!p) continue; const list = rawMembers.get(m.team_id) || []; if (!list.some((x) => x.id === p.id)) list.push(p); rawMembers.set(m.team_id, list); }
    const teamMem = new Map<string, Person[]>();
    for (const t of teams) { const mem = (rawMembers.get(t.id) || []).filter((p) => !placed.has(p.id)); mem.forEach((p) => placed.add(p.id)); teamMem.set(t.id, mem); }
    // a team hangs under the sector where most of its people are (its supervisor's sector while it has nobody);
    // a team with no sector at all hangs straight under the company — there is no fake "Sem setor" sector
    const teamSector = new Map<string, string | null>();
    for (const t of teams) {
      const count = new Map<string, number>();
      for (const p of rawMembers.get(t.id) || []) { const sid = sectorOf(p); if (sid) count.set(sid, (count.get(sid) || 0) + 1); }
      const best = [...count.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      const sp = sup.get(t.id);
      const sid = best || (sp ? sectorOf(sp) : null);
      teamSector.set(t.id, sid && secs.some((s) => s.id === sid) ? sid : null);
    }
    const personNode = (p: Person, sub: string): N => ({ key: `p-${p.id}`, lv: 'D', title: pname(p), lines: [sub], photo: p.avatar_url, person: p, kids: [] });
    const limit = (key: string, list: N[]): N[] => {
      if (f || list.length <= SHOW + 1) return list;
      if (open.has(key)) return [...list, { key: `${key}-less`, lv: 'D', title: '−', lines: [], kids: [], more: { parent: key, count: 0, less: true } }];
      return [...list.slice(0, SHOW), { key: `${key}-more`, lv: 'D', title: `+${list.length - SHOW}`, lines: [], kids: [], more: { parent: key, count: list.length - SHOW } }];
    };
    const teamNode = (t: Team, tint?: string): N => {
      const sp = sup.get(t.id) || null; const mem = teamMem.get(t.id) || []; const key = `t-${t.id}`;
      return { key, lv: 'C', title: t.name, lines: [sp ? `Supervisor(a): ${pname(sp)}` : 'Sem supervisor', plural(mem.length, 'pessoa', 'pessoas')], photo: sp?.avatar_url, tint, person: sp || undefined, kids: limit(key, mem.map((p) => personNode(p, t.name))) };
    };
    const bs: N[] = secs.map((s) => {
      const m = manager.get(s.id) || null;
      const members = people.filter((p) => p.sector_id === s.id);
      const loose = members.filter((p) => !placed.has(p.id)); loose.forEach((p) => placed.add(p.id));
      const key = `s-${s.id}`;
      const tint = s.color || undefined;
      return { key, lv: 'B', title: s.name, lines: [m ? `Gestor(a): ${pname(m)}` : 'Sem gestor definido', plural(members.length, 'pessoa', 'pessoas')], photo: m?.avatar_url, tint, person: m || undefined,
        kids: [...teams.filter((t) => teamSector.get(t.id) === s.id).map((t) => teamNode(t, tint)), ...limit(key, loose.map((p) => personNode(p, s.name)))] };
    });
    // teams without a sector and people without a sector (and in no team) report straight to the company
    const topTeams = teams.filter((t) => !teamSector.get(t.id)).map((t) => teamNode(t));
    const rest = people.filter((p) => !placed.has(p.id)).map((p) => personNode(p, 'Sem setor'));
    const counts = [plural(people.length, 'pessoa', 'pessoas'), plural(secs.length, 'setor', 'setores'), teams.length ? plural(teams.length, 'equipe', 'equipes') : ''].filter(Boolean).join(' · ');
    return { key: 'root', lv: 'A', title: company?.name || 'Empresa', lines: [counts, 'Estrutura da empresa'], photo: logo, kids: [...bs, ...topTeams, ...limit('root', rest)] };
  }, [people, sectors, teams, tms, open, f, company?.name, logo]);

  // zoom with the CSS zoom property (it changes the layout, so the scroll area follows the real size)
  const applyZoom = useCallback((z: number, mode: 'keep' | 'center' | 'center-x') => {
    const sc = scroller.current, cv = canvas.current; if (!sc || !cv) return;
    const z2 = Math.max(0.3, Math.min(1.4, +z.toFixed(2)));
    const cx = (sc.scrollLeft + sc.clientWidth / 2) / Math.max(1, sc.scrollWidth), cy = (sc.scrollTop + sc.clientHeight / 2) / Math.max(1, sc.scrollHeight);
    cv.style.zoom = String(z2); setZoom(z2);
    if (mode === 'keep') { sc.scrollLeft = cx * sc.scrollWidth - sc.clientWidth / 2; sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2; return; }
    sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
    if (mode === 'center') sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
  }, []);
  const fitZoom = useCallback((both: boolean) => {
    const sc = scroller.current, cv = canvas.current; if (!sc || !cv) return null;
    const z = Number(cv.style.zoom || 1) || 1; const r = cv.getBoundingClientRect();
    const zw = (sc.clientWidth - 16) / (r.width / z), zh = (sc.clientHeight - 16) / (r.height / z);
    return Math.min(1, both ? Math.min(zw, zh) : zw);
  }, []);
  // until the person zooms by hand, the chart fits the screen again whenever the data changes (never below 60%)
  useLayoutEffect(() => { if (manual.current) return; const z = fitZoom(true); if (z) applyZoom(Math.max(MIN_AUTO, z), 'center-x'); }, [tree, height, fitZoom, applyZoom]);

  const hit = (n: N) => !!f && (n.title.toLowerCase().includes(f) || (!!n.person && pname(n.person).toLowerCase().includes(f)));
  useEffect(() => {
    if (!f) return;
    const t = window.setTimeout(() => { canvas.current?.querySelector('.oc-hit')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }, 150);
    return () => window.clearTimeout(t);
  }, [f]);
  const zoomBy = (d: number) => { manual.current = true; applyZoom(zoom + d, 'keep'); };

  // drag the background to move around
  const onDown = (e: RPointerEvent) => { const sc = scroller.current; if (!sc || e.button !== 0 || (e.target as HTMLElement).closest('button,input,.oc-card')) return; drag.current = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, id: e.pointerId }; sc.setPointerCapture(e.pointerId); sc.classList.add('drag'); };
  const onMove = (e: RPointerEvent) => { const sc = scroller.current, d = drag.current; if (!sc || !d) return; sc.scrollLeft = d.l - (e.clientX - d.x); sc.scrollTop = d.t - (e.clientY - d.y); };
  const onUp = () => { const sc = scroller.current, d = drag.current; if (sc && d) { try { sc.releasePointerCapture(d.id); } catch { /* already released */ } sc.classList.remove('drag'); } drag.current = null; };

  const render = (n: N): ReactNode => {
    let body: ReactNode;
    if (n.lv === 'D') {
      const more = n.more;
      body = more
        ? <button type="button" className="oc-person oc-more" onClick={() => setOpen((s) => { const x = new Set(s); if (more.less) x.delete(more.parent); else x.add(more.parent); return x; })} aria-label={more.less ? 'Mostrar menos pessoas' : `Mostrar mais ${more.count} pessoas`}>
            <span className="oc-ring"><span className="oc-ph">{n.title}</span></span><span className="oc-nm">{more.less ? 'Ver menos' : 'Ver todos'}</span>
          </button>
        : <button type="button" className={`oc-person${hit(n) ? ' oc-hit' : ''}`} onClick={() => n.person && setPreview(n.person.id)} title={n.title}>
            <span className="oc-ring"><Photo src={n.photo} label={n.title} /></span>
            <span className="oc-nm">{n.title}</span>
            <span className="oc-sm">{n.lines[0]}</span>
          </button>;
    } else {
      const person = n.person;
      const click = person ? () => setPreview(person.id) : undefined;
      body = (
        <div className={`oc-card lv-${n.lv.toLowerCase()}${hit(n) ? ' oc-hit' : ''}${click ? ' oc-click' : ''}`} onClick={click} role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined} onKeyDown={(e) => { if (click && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); click(); } }} title={person ? `Ver perfil de ${pname(person)}` : undefined}>
          <span className="oc-tag">Nível {n.lv}</span>
          {n.lv !== 'A' ? <span className="oc-av"><Photo src={n.photo} label={person ? pname(person) : n.title} tint={n.tint} /></span> : null}
          <span className="oc-tx"><span className="oc-ti">{n.title}</span>{n.lines.map((l, i) => <span key={i} className="oc-sm">{l}</span>)}</span>
        </div>
      );
    }
    return <li key={n.key}>{n.lv === 'A' ? <><div className="oc-top"><Photo src={n.photo} label={n.title} tint="var(--oc-a)" /></div>{body}</> : body}{n.kids.length ? <ul>{n.kids.map(render)}</ul> : null}</li>;
  };

  return (
    <div ref={stage} className="oc-stage" style={{ height }}>
      <div className="oc-tools" role="toolbar" aria-label="Organograma">
        <button type="button" onClick={() => zoomBy(-0.1)} aria-label="Diminuir" title="Diminuir"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => { manual.current = true; applyZoom(1, 'keep'); }} aria-label="Tamanho real" title="Tamanho real">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => zoomBy(0.1)} aria-label="Aumentar" title="Aumentar"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => { manual.current = true; const z = fitZoom(true); if (z) applyZoom(z, 'center'); }} aria-label="Ajustar à tela" title="Ver o organograma inteiro"><Maximize2 className="h-4 w-4" /></button>
        <span className="oc-find"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa, setor ou equipe" aria-label="Buscar no organograma" /></span>
      </div>
      <div ref={scroller} className="oc-scroll" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={canvas} className="oc-canvas">
          <ul className="oc-tree">{render(tree)}</ul>
          <div className="oc-legend">
            <span><i style={{ background: 'var(--oc-a)' }} />Nível A · empresa</span>
            <span><i style={{ background: 'var(--oc-b)' }} />Nível B · setores e gestores</span>
            <span><i style={{ background: 'var(--oc-c)' }} />Nível C · equipes e supervisores</span>
            <span><i style={{ background: 'var(--oc-d)' }} />Nível D · pessoas</span>
          </div>
        </div>
      </div>
      {preview ? <UserPreviewDialog open onOpenChange={(o) => { if (!o) setPreview(null); }} profileId={preview} userId="" /> : null}
    </div>
  );
}
