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
    // the general sector (everyone who has no other sector) is a normal branch, drawn last
    const secs = [...((sectors || []) as unknown as Sec[])].sort((a, b) => Number(!!a.is_general) - Number(!!b.is_general));
    const known = new Set(secs.map((s) => s.id));
    const teamMembers = new Map<string, Person[]>();
    for (const m of tms) { if (!m.team_id) continue; const p = byId.get(m.member_profile_id); if (!p) continue; const a = teamMembers.get(m.team_id) || []; if (!a.some((x) => x.id === p.id)) a.push(p); teamMembers.set(m.team_id, a); }
    // each team belongs to the sector where most of its members are (or its supervisor's, when it has nobody yet)
    const teamSector = new Map<string, string>();
    for (const t of teams) {
      const count = new Map<string, number>();
      for (const p of teamMembers.get(t.id) || []) { const s = p.sector_id && known.has(p.sector_id) ? p.sector_id : 'none'; count.set(s, (count.get(s) || 0) + 1); }
      let best = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!best) { const sup = t.supervisor_id ? byUser.get(t.supervisor_id) : undefined; best = sup?.sector_id && known.has(sup.sector_id) ? sup.sector_id : undefined; }
      if (best) teamSector.set(t.id, best);
    }
    const personNode = (p: Person, sub: string): N => ({ key: `p-${p.id}`, lv: 'D', title: pname(p), lines: [sub], photo: p.avatar_url, person: p, kids: [] });
    const limit = (key: string, list: N[]): N[] => {
      if (f || list.length <= SHOW + 1) return list;
      if (open.has(key)) return [...list, { key: `${key}-less`, lv: 'D', title: '−', lines: [], kids: [], more: { parent: key, count: 0, less: true } }];
      return [...list.slice(0, SHOW), { key: `${key}-more`, lv: 'D', title: `+${list.length - SHOW}`, lines: [], kids: [], more: { parent: key, count: list.length - SHOW } }];
    };
    const sectorNode = (id: string, name: string, color: string | null | undefined, managerId: string | null): N => {
      const manager = managerId ? byId.get(managerId) || null : null;
      const members = people.filter((p) => (id === 'none' ? !p.sector_id || !known.has(p.sector_id) : p.sector_id === id));
      const inTeams = new Set<string>();
      const supIds = new Set<string>();
      const teamNodes: N[] = teams.filter((t) => teamSector.get(t.id) === id).map((t) => {
        const sup = t.supervisor_id ? byUser.get(t.supervisor_id) || null : null;
        if (sup) supIds.add(sup.id);
        const mem = (teamMembers.get(t.id) || []).filter((p) => p.id !== sup?.id && p.id !== manager?.id);
        mem.forEach((p) => inTeams.add(p.id));
        const key = `t-${t.id}`;
        return { key, lv: 'C', title: t.name, lines: [sup ? `Supervisor(a): ${pname(sup)}` : 'Sem supervisor', plural(mem.length, 'pessoa', 'pessoas')], photo: sup?.avatar_url, tint: color || undefined, person: sup || undefined, kids: limit(key, mem.map((p) => personNode(p, t.name))) };
      });
      const loose = members.filter((p) => p.id !== manager?.id && !inTeams.has(p.id) && !supIds.has(p.id)).map((p) => personNode(p, name));
      const key = `s-${id}`;
      return { key, lv: 'B', title: name, lines: [manager ? `Gestor(a): ${pname(manager)}` : 'Sem gestor definido', plural(members.length, 'pessoa', 'pessoas')], photo: manager?.avatar_url, tint: color || undefined, person: manager || undefined, kids: [...teamNodes, ...limit(key, loose)] };
    };
    const bs: N[] = secs.map((s) => sectorNode(s.id, s.name, s.color, s.manager_id || null)).filter((n) => n.kids.length || n.person);
    if (people.some((p) => !p.sector_id || !known.has(p.sector_id))) bs.push(sectorNode('none', 'Sem setor', '#9e9e9e', null));
    const counts = [plural(people.length, 'pessoa', 'pessoas'), plural(secs.length, 'setor', 'setores'), teams.length ? plural(teams.length, 'equipe', 'equipes') : ''].filter(Boolean).join(' · ');
    return { key: 'root', lv: 'A', title: company?.name || 'Empresa', lines: [counts, 'Estrutura da empresa'], photo: logo, kids: bs };
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
  // until the person zooms by hand, the chart fits the width again whenever the data changes
  useLayoutEffect(() => { if (manual.current) return; const z = fitZoom(false); if (z) applyZoom(Math.max(MIN_AUTO, z), 'center-x'); }, [tree, height, fitZoom, applyZoom]);

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
