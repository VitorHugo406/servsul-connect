// "Responsáveis por departamento": a switch + people per department label. On = "Duplicar todos os cards" gives each
// new card the people of its department labels (task_labels.default_assignees; the first person of the first label is
// the responsável, everyone else becomes co-responsável; task_board_columns.template_auto_assign);
// off = manual adjustment (cards are created without a responsible, as before). Used by TemplatesDialog (before the
// mural exists) and DuplicateTemplatesDialog (saved on the mural). People = active colleagues + yourself.
// A whole sector can be picked too ("s:<sector id>" in the picks; task_labels.default_sectors): everyone whose main or
// additional sector it is joins the card (resolved at duplication time, so people who join the sector later count);
// in the list those people show faded and already ticked ("via <setor>").
import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Search, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Switch } from '@/components/ui/switch';

export type DeptMap = Record<string, string[]>; // label name → picks: profile ids and "s:<sector id>" (empty = nobody)
type Person = { id: string; user_id: string; name: string; sectors: string[] };
type Sector = { id: string; name: string; color: string | null };
const SP = 's:';
export const pickPeople = (picks: string[]) => picks.filter((x) => !x.startsWith(SP));
export const pickSectors = (picks: string[]) => picks.filter((x) => x.startsWith(SP)).map((x) => x.slice(SP.length));
/** Everyone a set of picks means, in order: people picked by name first (the first one is the responsável), then the
 *  people of the picked sectors (alphabetical), without repeats. */
export function expandPicks(picks: string[], people: Person[]) {
  const out = pickPeople(picks).filter((id) => people.some((p) => p.id === id));
  const secs = pickSectors(picks);
  if (secs.length) for (const p of people) if (!out.includes(p.id) && p.sectors.some((x) => secs.includes(x))) out.push(p.id);
  return out;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Saves the label → person choices and the switch on the mural's template column(s), and makes sure every chosen
 *  person is a member of the mural (otherwise they could not see the cards they are responsible for). */
export async function saveDeptAssignees(boardId: string, map: DeptMap, on: boolean, people: Person[], meProfileId: string) {
  const { data: labs, error } = await db.from('task_labels').select('id,name,default_assignees,default_sectors').eq('board_id', boardId);
  if (error) throw error;
  for (const l of (labs || []) as { id: string; name: string; default_assignees: string[] | null; default_sectors: string[] | null }[]) {
    if (!(l.name in map)) continue;
    const ppl = pickPeople(map[l.name] || []), secs = pickSectors(map[l.name] || []);
    if (ppl.join() !== (l.default_assignees || []).join() || secs.join() !== (l.default_sectors || []).join()) {
      const r = await db.from('task_labels').update({ default_assignees: ppl, default_sectors: secs, default_assignee: ppl[0] || null }).eq('id', l.id);
      if (r.error) throw r.error;
    }
  }
  const r = await db.from('task_board_columns').update({ template_auto_assign: on }).eq('board_id', boardId).eq('is_template_column', true);
  if (r.error) throw r.error;
  const chosen = [...new Set(Object.values(map).flatMap((v) => expandPicks(v, people)))].filter((id) => id !== meProfileId);
  if (on && chosen.length) {
    const { data: mem } = await db.from('task_board_members').select('profile_id').eq('board_id', boardId);
    const have = new Set(((mem || []) as { profile_id: string }[]).map((m) => m.profile_id));
    const add = chosen.filter((id) => !have.has(id)).map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p)
      .map((p) => ({ board_id: boardId, user_id: p.user_id, profile_id: p.id, role: 'member' }));
    if (add.length) await db.from('task_board_members').insert(add);
  }
}

/** Active colleagues + yourself (with their main and additional sectors) and the company's sectors. */
export function useOrg() {
  const { profile } = useAuth();
  const { users } = useActiveUsers();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [extra, setExtra] = useState<{ user_id: string; sector_id: string }[]>([]);
  const cid = profile?.company_id;
  useEffect(() => {
    if (!cid) return;
    let live = true;
    void Promise.all([
      db.from('sectors').select('id,name,color').eq('company_id', cid).order('name'),
      db.from('user_additional_sectors').select('user_id,sector_id'),
    ]).then(([s, x]: { data: unknown }[]) => { if (!live) return; setSectors((s.data || []) as Sector[]); setExtra((x.data || []) as { user_id: string; sector_id: string }[]); });
    return () => { live = false; };
  }, [cid]);
  const people = useMemo(() => {
    const base = users.map((u) => ({ id: u.id, user_id: u.user_id, name: u.display_name || u.name || 'Colaborador', main: (u as { sector_id?: string | null }).sector_id || null }));
    if (profile && !base.some((u) => u.id === profile.id)) base.push({ id: profile.id, user_id: (profile as { user_id: string }).user_id, name: profile.display_name || profile.name || 'Você', main: (profile as { sector_id?: string | null }).sector_id || null });
    return base.map(({ main, ...p }) => ({ ...p, sectors: [...new Set([main, ...extra.filter((e) => e.user_id === p.user_id).map((e) => e.sector_id)].filter((x): x is string => !!x))] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [users, profile, extra]);
  return { people, sectors };
}
export function usePeople() { return useOrg().people; }

export function DeptAssignees({ depts, value, onChange, on, setOn, readOnly, compact }: {
  depts: { name: string; color: string }[]; value: DeptMap; onChange: (v: DeptMap) => void; on: boolean; setOn: (v: boolean) => void; readOnly?: boolean; compact?: boolean;
}) {
  const { people, sectors } = useOrg();
  if (!depts.length) return null;
  const filled = depts.filter((d) => value[d.name]?.length).length;
  return (
    <section className={`flex flex-col gap-3 rounded-[12px] border border-border ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Responsáveis por departamento</p>
          <p className="text-xs text-muted-foreground">{on ? `Ao duplicar os cards, cada um já vem com as pessoas da sua etiqueta: a primeira é a responsável e as demais entram como co-responsáveis${filled < depts.length ? ' (etiquetas sem pessoa ficam sem responsável)' : ''}.` : 'Desligado: ajuste manual — os cards são criados sem responsável.'}</p>
        </div>
        <Switch checked={on} onCheckedChange={setOn} disabled={readOnly} aria-label="Atribuir responsáveis pelas etiquetas" />
      </div>
      {on ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {depts.map((d) => (
            <div key={d.name} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="inline-flex h-8 w-[92px] shrink-0 items-center truncate rounded-[4px] px-2 text-xs font-bold text-white" style={{ backgroundColor: d.color, textShadow: '0 1px 1px rgba(0,0,0,.25)' }}>{d.name}</span>
              <PeoplePicker label={d.name} people={people} sectors={sectors} value={value[d.name] || []} readOnly={readOnly} onChange={(v) => onChange({ ...value, [d.name]: v })} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Dropdown with search + checkboxes: sectors first (a sector ticks everyone in it — shown faded, "via <setor>"),
 *  then people. Order of picking = order on the card: the first person picked by name is the responsável. */
function PeoplePicker({ label, people, sectors, value, onChange, readOnly }: { label: string; people: Person[]; sectors: Sector[]; value: string[]; onChange: (v: string[]) => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || 'Colaborador';
  const secName = (id: string) => sectors.find((x) => x.id === id)?.name || 'Setor';
  const f = norm(q.trim());
  const secs = pickSectors(value);
  const ppl = pickPeople(value);
  const all = expandPicks(value, people);
  const sList = sectors.filter((x) => !f || norm(x.name).includes(f));
  const pList = people.filter((p) => !f || norm(p.name).includes(f));
  const viaSec = (p: Person) => p.sectors.find((x) => secs.includes(x));
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((x) => x !== key) : [...value, key]);
  const count = (sid: string) => people.filter((p) => p.sectors.includes(sid)).length;
  const summary = !value.length ? 'Sem responsável'
    : [...secs.map(secName), ...ppl.map(nameOf)].slice(0, 1).join('') + ([...secs, ...ppl].length > 1 ? ` +${[...secs, ...ppl].length - 1}` : '');
  const box = (on: boolean, soft?: boolean) => <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${on ? (soft ? 'border-primary/50 bg-primary/40 text-primary-foreground' : 'border-primary bg-primary text-primary-foreground') : 'border-input'}`}>{on ? <Check className="h-3 w-3" /> : null}</span>;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
      <PopoverTrigger asChild disabled={readOnly}>
        <button type="button" className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-input bg-background px-2.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-60" aria-label={`Pessoas de ${label}`} title={all.length ? `${all.length} ${all.length === 1 ? 'pessoa' : 'pessoas'}` : undefined}>
          {secs.length ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
          <span className={`min-w-0 flex-1 truncate ${value.length ? '' : 'text-muted-foreground'}`}>{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] rounded-[12px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar setor ou pessoa" className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label={`Pesquisar pessoa para ${label}`} />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {sList.length ? <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Setores</p> : null}
          {sList.map((x) => {
            const on = secs.includes(x.id);
            return (
              <button key={x.id} type="button" role="option" aria-selected={on} onClick={() => toggle(SP + x.id)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-sm hover:bg-muted">
                {box(on)}
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.color || '#94a3b8' }} />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{count(x.id)} {count(x.id) === 1 ? 'pessoa' : 'pessoas'}</span>
              </button>);
          })}
          {pList.length ? <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pessoas</p> : null}
          {!sList.length && !pList.length ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nada encontrado.</p> : null}
          {pList.map((p) => {
            const k = ppl.indexOf(p.id);
            const via = k < 0 ? viaSec(p) : undefined;
            const pos = all.indexOf(p.id);
            return (
              <button key={p.id} type="button" role="option" aria-selected={k >= 0 || !!via} onClick={() => { if (!via) toggle(p.id); }} title={via ? `Já incluída pelo setor ${secName(via)}` : undefined}
                className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-sm ${via ? 'cursor-default opacity-50' : 'hover:bg-muted'}`}>
                {box(k >= 0 || !!via, !!via)}
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {via ? <span className="shrink-0 text-[10px] text-muted-foreground">via {secName(via)}</span>
                  : pos === 0 ? <span className="shrink-0 rounded-[4px] bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Responsável</span>
                  : k > 0 ? <span className="shrink-0 text-[10px] text-muted-foreground">Co-resp.</span> : null}
              </button>);
          })}
        </div>
        {value.length ? <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>{all.length} {all.length === 1 ? 'pessoa' : 'pessoas'} · a 1ª é a responsável</span><button type="button" className="font-medium text-primary hover:underline" onClick={() => onChange([])}>Limpar</button></div> : null}
      </PopoverContent>
    </Popover>
  );
}
