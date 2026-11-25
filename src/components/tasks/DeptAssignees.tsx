// "Responsáveis por departamento": a switch + one person per department label. On = "Duplicar todos os cards" gives
// each new card the person of its department label (task_labels.default_assignee, task_board_columns.template_auto_assign);
// off = manual adjustment (cards are created without a responsible, as before). Used by TemplatesDialog (before the
// mural exists) and DuplicateTemplatesDialog (saved on the mural). People = active colleagues + yourself.
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Switch } from '@/components/ui/switch';
import { Sel } from '@/components/ui/Sel';

export type DeptMap = Record<string, string>; // label name → profile id ('' = nobody)
type Person = { id: string; user_id: string; name: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Saves the label → person choices and the switch on the mural's template column(s), and makes sure every chosen
 *  person is a member of the mural (otherwise they could not see the cards they are responsible for). */
export async function saveDeptAssignees(boardId: string, map: DeptMap, on: boolean, people: Person[], meProfileId: string) {
  const { data: labs, error } = await db.from('task_labels').select('id,name,default_assignee').eq('board_id', boardId);
  if (error) throw error;
  for (const l of (labs || []) as { id: string; name: string; default_assignee: string | null }[]) {
    if (!(l.name in map)) continue;
    const want = map[l.name] || null;
    if (want !== l.default_assignee) { const r = await db.from('task_labels').update({ default_assignee: want }).eq('id', l.id); if (r.error) throw r.error; }
  }
  const r = await db.from('task_board_columns').update({ template_auto_assign: on }).eq('board_id', boardId).eq('is_template_column', true);
  if (r.error) throw r.error;
  const chosen = [...new Set(Object.values(map).filter(Boolean))].filter((id) => id !== meProfileId);
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
  const filled = depts.filter((d) => value[d.name]).length;
  return (
    <section className={`flex flex-col gap-3 rounded-[12px] border border-border ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Responsáveis por departamento</p>
          <p className="text-xs text-muted-foreground">{on ? `Ao duplicar os cards, cada um já vem com o responsável da sua etiqueta${filled < depts.length ? ' (etiquetas sem pessoa ficam sem responsável)' : ''}.` : 'Desligado: ajuste manual — os cards são criados sem responsável.'}</p>
        </div>
        <Switch checked={on} onCheckedChange={setOn} disabled={readOnly} aria-label="Atribuir responsáveis pelas etiquetas" />
      </div>
      {on ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {depts.map((d) => (
            <label key={d.name} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="inline-flex h-7 w-[92px] shrink-0 items-center truncate rounded-[4px] px-2 text-xs font-bold text-white" style={{ backgroundColor: d.color, textShadow: '0 1px 1px rgba(0,0,0,.25)' }}>{d.name}</span>
              <Sel className="ui-sel h-8 min-w-0 flex-1" value={value[d.name] || ''} disabled={readOnly} onChange={(e) => onChange({ ...value, [d.name]: e.target.value })} aria-label={`Responsável por ${d.name}`}>
                <option value="">Sem responsável</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Sel>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
