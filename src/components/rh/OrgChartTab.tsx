// Organograma: the company → sectors (with their manager, sectors.manager_id) → people, plus the supervised teams
// (teams / supervisor_team_members) when the person can see them. Read-only, built from existing tables.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useSectors } from '@/hooks/useData';
import { useCompany } from '@/contexts/CompanyContext';
import { Av, db, pname, usePeople, type Person } from './rhShared';

type Team = { id: string; name: string; supervisor_id: string | null };
type TM = { team_id: string | null; member_profile_id: string; supervisor_id: string };

export function OrgChartTab() {
  const { company } = useCompany();
  const { sectors } = useSectors();
  const { list: people } = usePeople();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);
  const [tms, setTms] = useState<TM[]>([]);
  useEffect(() => {
    void Promise.all([db.from('teams').select('id,name,supervisor_id').order('name'), db.from('supervisor_team_members').select('team_id,member_profile_id,supervisor_id')])
      .then(([t, m]: any[]) => { setTeams(t.data || []); setTms(m.data || []); }).catch(() => undefined);
  }, []);
  const f = q.trim().toLowerCase();
  const match = (p: Person) => !f || pname(p).toLowerCase().includes(f);
  const byUser = useMemo(() => new Map(people.filter((p) => p.user_id).map((p) => [p.user_id as string, p])), [people]);
  const groups = useMemo(() => {
    const list = (sectors || []).filter((s: any) => !s.is_general).map((s: any) => ({ id: s.id as string, name: s.name as string, color: (s.color as string) || 'hsl(var(--primary))', manager: people.find((p) => p.id === s.manager_id) || null, members: people.filter((p) => p.sector_id === s.id) }));
    const known = new Set(list.map((g) => g.id));
    const none = people.filter((p) => !p.sector_id || !known.has(p.sector_id));
    if (none.length) list.push({ id: 'none', name: 'Sem setor definido', color: '#8A94A3', manager: null, members: none });
    return list;
  }, [sectors, people]);
  const shown = groups.map((g) => ({ ...g, members: g.members.filter(match) })).filter((g) => !f || g.members.length || g.name.toLowerCase().includes(f) || (g.manager && match(g.manager)));
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-[14px] border border-border bg-card px-4 py-3"><div className="text-xs text-muted-foreground">Empresa</div><div className="text-base font-semibold">{company?.name || 'Empresa'}</div><div className="text-xs text-muted-foreground">{people.length} pessoas · {groups.length} setores</div></div>
        <span className="flex-1" />
        <label className="flex h-10 items-center gap-2 rounded-[10px] border border-border bg-card px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa ou setor" aria-label="Buscar pessoa ou setor" className="w-56 bg-transparent text-sm outline-none" /></label>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((g) => {
          const all = open.has(g.id) || !!f; const list = all ? g.members : g.members.slice(0, 8);
          return (
            <section key={g.id} className="flex flex-col overflow-hidden rounded-[16px] border border-border bg-card">
              <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: g.color }} />
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{g.name}</div><div className="text-xs text-muted-foreground">{g.members.length} {g.members.length === 1 ? 'pessoa' : 'pessoas'}</div></div>
              </header>
              <div className="flex items-center gap-2.5 bg-muted/40 px-4 py-2.5 text-sm">
                {g.manager ? <><Av p={g.manager} size={28} /><span className="min-w-0 truncate"><b className="font-medium">{pname(g.manager)}</b><span className="text-muted-foreground"> · gestor(a)</span></span></> : <span className="text-muted-foreground">Sem gestor definido</span>}
              </div>
              <ul className="flex flex-col py-1">
                {list.filter((p) => p.id !== g.manager?.id).map((p) => <li key={p.id} className="flex items-center gap-2.5 px-4 py-1.5 text-sm"><Av p={p} size={26} /><span className="min-w-0 truncate">{pname(p)}</span></li>)}
                {!g.members.length ? <li className="px-4 py-2 text-sm text-muted-foreground">Ninguém neste setor.</li> : null}
              </ul>
              {!f && g.members.length > 8 ? <button type="button" onClick={() => toggle(g.id)} className="flex items-center justify-center gap-1 border-t border-border py-2 text-xs font-medium text-primary hover:bg-muted/40">{all ? <><ChevronUp className="h-3.5 w-3.5" />Mostrar menos</> : <><ChevronDown className="h-3.5 w-3.5" />Ver todos ({g.members.length})</>}</button> : null}
            </section>
          );
        })}
      </div>
      {teams.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Equipes</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => {
              const sup = t.supervisor_id ? byUser.get(t.supervisor_id) : undefined;
              const mem = tms.filter((m) => m.team_id === t.id).map((m) => people.find((p) => p.id === m.member_profile_id)).filter(Boolean) as Person[];
              if (f && !mem.some(match) && !(sup && match(sup)) && !t.name.toLowerCase().includes(f)) return null;
              return (
                <section key={t.id} className="rounded-[16px] border border-border bg-card p-4">
                  <div className="font-semibold">{t.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm">{sup ? <><Av p={sup} size={24} /><span>{pname(sup)} <span className="text-muted-foreground">· supervisor(a)</span></span></> : <span className="text-muted-foreground">Sem supervisor</span>}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">{mem.map((p) => <span key={p.id} title={pname(p)} className="flex items-center gap-1.5 rounded-full bg-muted/60 py-0.5 pl-0.5 pr-2.5 text-xs"><Av p={p} size={22} />{pname(p).split(' ')[0]}</span>)}{!mem.length ? <span className="text-xs text-muted-foreground">Sem membros</span> : null}</div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
