// "Responsáveis por departamento": a switch + people per department label. On = "Duplicar todos os cards" gives each
// new card the people of its department labels (task_labels.default_assignees; the first person of the first label is
// the responsável, everyone else becomes co-responsável; task_board_columns.template_auto_assign);
// off = manual adjustment (cards are created without a responsible, as before). Used by TemplatesDialog (before the
// mural exists) and DuplicateTemplatesDialog (saved on the mural). People = active colleagues + yourself.
import { useMemo } from 'react';
import { Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Switch } from '@/components/ui/switch';
import { Sel } from '@/components/ui/Sel';

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
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || 'Colaborador';
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
        <div className="flex flex-col divide-y divide-border">
          {depts.map((d) => {
            const sel = value[d.name] || [];
            const left = people.filter((p) => !sel.includes(p.id));
            return (
              <div key={d.name} className="flex min-w-0 flex-wrap items-center gap-2 py-2 text-sm first:pt-0 last:pb-0">
                <span className="inline-flex h-7 w-[92px] shrink-0 items-center truncate rounded-[4px] px-2 text-xs font-bold text-white" style={{ backgroundColor: d.color, textShadow: '0 1px 1px rgba(0,0,0,.25)' }}>{d.name}</span>
                {sel.map((id, k) => (
                  <span key={id} className="inline-flex h-7 max-w-[190px] items-center gap-1 rounded-[8px] border border-border bg-muted/50 pl-2 pr-1 text-xs" title={k === 0 ? 'Responsável' : 'Co-responsável'}>
                    <span className="truncate">{nameOf(id)}</span>{k === 0 && sel.length > 1 ? <span className="shrink-0 text-[10px] text-muted-foreground">resp.</span> : null}
                    {readOnly ? null : <button type="button" className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onChange({ ...value, [d.name]: sel.filter((x) => x !== id) })} aria-label={`Tirar ${nameOf(id)} de ${d.name}`}><X className="h-3 w-3" /></button>}
                  </span>
                ))}
                {readOnly || !left.length ? (sel.length ? null : <span className="text-xs text-muted-foreground">Sem responsável</span>) : (
                  <Sel className="ui-sel h-7 w-[170px] text-xs" value="" onChange={(e) => { if (e.target.value) onChange({ ...value, [d.name]: [...sel, e.target.value] }); }} aria-label={`Adicionar pessoa em ${d.name}`}>
                    <option value="">{sel.length ? '+ Adicionar pessoa' : 'Sem responsável'}</option>
                    {left.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Sel>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
