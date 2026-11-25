// "Responsáveis por departamento": a switch + people per department label. On = "Duplicar todos os cards" gives each
// new card the people of its department labels (task_labels.default_assignees; the first person of the first label is
// the responsável, everyone else becomes co-responsável; task_board_columns.template_auto_assign);
// off = manual adjustment (cards are created without a responsible, as before). Used by TemplatesDialog (before the
// mural exists) and DuplicateTemplatesDialog (saved on the mural). People = active colleagues + yourself.
import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, Users } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Switch } from '@/components/ui/switch';

export type DeptMap = Record<string, string[]>; // label name → profile ids (empty = nobody)
type Person = { id: string; user_id: string; name: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Saves the label → person choices and the switch on the mural's template column(s), and makes sure every chosen
 *  person is a member of the mural (otherwise they could not see the cards they are responsible for). */
export async function saveDeptAssignees(boardId: string, map: DeptMap, on: boolean, people: Person[], meProfileId: string) {
  const { data: labs, error } = await db.from('task_labels').select('id,name,default_assignees').eq('board_id', boardId);
  if (error) throw error;
  for (const l of (labs || []) as { id: string; name: string; default_assignees: string[] | null }[]) {
    if (!(l.name in map)) continue;
    const want = map[l.name] || [];
    if (want.join() !== (l.default_assignees || []).join()) { const r = await db.from('task_labels').update({ default_assignees: want, default_assignee: want[0] || null }).eq('id', l.id); if (r.error) throw r.error; }
  }
  const r = await db.from('task_board_columns').update({ template_auto_assign: on }).eq('board_id', boardId).eq('is_template_column', true);
  if (r.error) throw r.error;
  const chosen = [...new Set(Object.values(map).flat().filter(Boolean))].filter((id) => id !== meProfileId);
  if (on && chosen.length) {
    const { data: mem } = await db.from('task_board_members').select('profile_id').eq('board_id', boardId);
    const have = new Set(((mem || []) as { profile_id: string }[]).map((m) => m.profile_id));
    const add = chosen.filter((id) => !have.has(id)).map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p)
      .map((p) => ({ board_id: boardId, user_id: p.user_id, profile_id: p.id, role: 'member' }));
    if (add.length) await db.from('task_board_members').insert(add);
  }
}

export function usePeople() {
  const { profile } = useAuth();
  const { users } = useActiveUsers();
  return useMemo(() => {
    const list = users.map((u) => ({ id: u.id, user_id: u.user_id, name: u.display_name || u.name || 'Colaborador' }));
    if (profile && !list.some((u) => u.id === profile.id)) list.push({ id: profile.id, user_id: (profile as { user_id: string }).user_id, name: profile.display_name || profile.name || 'Você' });
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [users, profile]);
}

export function DeptAssignees({ depts, value, onChange, on, setOn, readOnly, compact }: {
  depts: { name: string; color: string }[]; value: DeptMap; onChange: (v: DeptMap) => void; on: boolean; setOn: (v: boolean) => void; readOnly?: boolean; compact?: boolean;
}) {
  const people = usePeople();
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
              <PeoplePicker label={d.name} people={people} value={value[d.name] || []} readOnly={readOnly} onChange={(v) => onChange({ ...value, [d.name]: v })} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Dropdown with search + checkboxes. Order of picking = order on the card: the first one is the responsável. */
function PeoplePicker({ label, people, value, onChange, readOnly }: { label: string; people: Person[]; value: string[]; onChange: (v: string[]) => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || 'Colaborador';
  const list = people.filter((p) => !q.trim() || norm(p.name).includes(norm(q.trim())));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const summary = !value.length ? 'Sem responsável' : value.length === 1 ? nameOf(value[0]) : `${nameOf(value[0])} +${value.length - 1}`;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
      <PopoverTrigger asChild disabled={readOnly}>
        <button type="button" className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-input bg-background px-2.5 text-left text-sm transition-colors hover:bg-muted/50 disabled:opacity-60" aria-label={`Pessoas de ${label}`}>
          <span className={`min-w-0 flex-1 truncate ${value.length ? '' : 'text-muted-foreground'}`}>{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] rounded-[12px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar pessoa" className="h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label={`Pesquisar pessoa para ${label}`} />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {!list.length ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">Ninguém encontrado.</p> : list.map((p) => {
            const k = value.indexOf(p.id);
            return (
              <button key={p.id} type="button" role="option" aria-selected={k >= 0} onClick={() => toggle(p.id)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-sm hover:bg-muted">
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border ${k >= 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>{k >= 0 ? <Check className="h-3 w-3" /> : null}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {k === 0 ? <span className="shrink-0 rounded-[4px] bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">Responsável</span> : k > 0 ? <span className="shrink-0 text-[10px] text-muted-foreground">Co-resp.</span> : null}
              </button>);
          })}
        </div>
        {value.length ? <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground"><span>{value.length} {value.length === 1 ? 'selecionada' : 'selecionadas'} · a 1ª é a responsável</span><button type="button" className="font-medium text-primary hover:underline" onClick={() => onChange([])}>Limpar</button></div> : null}
      </PopoverContent>
    </Popover>
  );
}
