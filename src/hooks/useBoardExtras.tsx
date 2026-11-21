// Custom fields + dependencies of ONE mural, shared by everything inside BoardView (card dialog, kanban cards, Lista,
// Linha do tempo) through BoardExtrasProvider. Tables: board_custom_fields, task_field_values, task_dependencies
// (migration 20261119060000). Values are JSON: text/select → string, number/money → number, date → 'yyyy-mm-dd',
// checkbox → boolean.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
export type FieldType = 'text' | 'number' | 'money' | 'date' | 'select' | 'checkbox';
export type CustomField = { id: string; board_id: string; name: string; type: FieldType; options: string[]; position: number; show_on_card: boolean };
export type Dep = { task_id: string; depends_on: string };
export const FIELD_TYPES: [FieldType, string][] = [['text', 'Texto'], ['number', 'Número'], ['money', 'Valor (R$)'], ['date', 'Data'], ['select', 'Lista de opções'], ['checkbox', 'Sim / Não']];

export function fieldText(f: CustomField, v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (f.type === 'money') return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (f.type === 'number') return Number(v).toLocaleString('pt-BR');
  if (f.type === 'date') { const [y, m, d] = String(v).split('-'); return d ? `${d}/${m}/${y}` : String(v); }
  if (f.type === 'checkbox') return v ? 'Sim' : 'Não';
  return String(v);
}

function useBoardExtrasState(boardId: string | null) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Map<string, unknown>>(new Map());   // key `${task}:${field}`
  const [deps, setDeps] = useState<Dep[]>([]);
  const [approvals, setApprovals] = useState<Map<string, string>>(new Map());   // task id → approver profile id (pending)
  const load = useCallback(async () => {
    if (!boardId) return;
    const { data: fs } = await db.from('board_custom_fields').select('id,board_id,name,type,options,position,show_on_card').eq('board_id', boardId).order('position');
    const list = (fs || []) as CustomField[];
    setFields(list);
    const vmap = new Map<string, unknown>();
    if (list.length) {
      const { data: vs } = await db.from('task_field_values').select('task_id,field_id,value').in('field_id', list.map((f) => f.id)).limit(10000);
      for (const r of vs || []) vmap.set(`${r.task_id}:${r.field_id}`, r.value);
    }
    setValues(vmap);
    const { data: ts } = await db.from('tasks').select('id').eq('board_id', boardId).limit(5000);
    const ids = ((ts || []) as { id: string }[]).map((t) => t.id);
    const out: Dep[] = [];
    for (let i = 0; i < ids.length; i += 300) { const { data: ds } = await db.from('task_dependencies').select('task_id,depends_on').in('task_id', ids.slice(i, i + 300)); out.push(...((ds || []) as Dep[])); }
    setDeps(out);
    const { data: ap } = await db.from('task_approvals').select('task_id,approver_id').eq('board_id', boardId).eq('status', 'pending').limit(2000);
    setApprovals(new Map(((ap || []) as { task_id: string; approver_id: string }[]).map((a) => [a.task_id, a.approver_id])));
  }, [boardId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!boardId) return;
    const ch = supabase.channel('board-extras-' + boardId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_field_values' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_dependencies' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_approvals', filter: `board_id=eq.${boardId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_custom_fields', filter: `board_id=eq.${boardId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [boardId, load]);

  const valueOf = useCallback((taskId: string, fieldId: string) => values.get(`${taskId}:${fieldId}`), [values]);
  const setValue = useCallback(async (taskId: string, fieldId: string, value: unknown) => {
    const k = `${taskId}:${fieldId}`; const prev = values.get(k);
    setValues((m) => { const n = new Map(m); if (value === null || value === '' || value === undefined) n.delete(k); else n.set(k, value); return n; });
    const empty = value === null || value === '' || value === undefined;
    const { error } = empty ? await db.from('task_field_values').delete().eq('task_id', taskId).eq('field_id', fieldId)
      : await db.from('task_field_values').upsert({ task_id: taskId, field_id: fieldId, value, updated_at: new Date().toISOString() });
    if (error) { toast.error('Não foi possível salvar o campo.'); setValues((m) => { const n = new Map(m); if (prev === undefined) n.delete(k); else n.set(k, prev); return n; }); }
  }, [values]);
  const saveField = useCallback(async (f: Partial<CustomField> & { name: string; type: FieldType }) => {
    const row = { board_id: boardId, name: f.name.trim().slice(0, 60), type: f.type, options: f.type === 'select' ? (f.options || []).map((o) => o.trim()).filter(Boolean) : [], show_on_card: f.show_on_card ?? false, position: f.position ?? fields.length };
    const { error } = f.id ? await db.from('board_custom_fields').update(row).eq('id', f.id) : await db.from('board_custom_fields').insert(row);
    if (error) { toast.error('Só o dono ou administrador do mural pode configurar campos.'); return false; }
    await load(); return true;
  }, [boardId, fields.length, load]);
  const deleteField = useCallback(async (id: string) => { const { error } = await db.from('board_custom_fields').delete().eq('id', id); if (error) toast.error('Não foi possível excluir o campo.'); await load(); }, [load]);
  const moveField = useCallback(async (id: string, dir: number) => {
    const i = fields.findIndex((f) => f.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= fields.length) return;
    const a = [...fields]; [a[i], a[j]] = [a[j], a[i]]; setFields(a);
    await Promise.all(a.map((f, k) => db.from('board_custom_fields').update({ position: k }).eq('id', f.id)));
  }, [fields]);

  const blockersOf = useCallback((taskId: string) => deps.filter((d) => d.task_id === taskId).map((d) => d.depends_on), [deps]);
  const blockingOf = useCallback((taskId: string) => deps.filter((d) => d.depends_on === taskId).map((d) => d.task_id), [deps]);
  const addDep = useCallback(async (taskId: string, dependsOn: string) => {
    if (taskId === dependsOn) return;
    // refuse cycles of any length (A → B → … → A)
    const seen = new Set<string>(); const stack = [dependsOn];
    while (stack.length) { const x = stack.pop()!; if (x === taskId) { toast.error('Isso criaria um ciclo de dependências.'); return; } if (seen.has(x)) continue; seen.add(x); for (const d of deps) if (d.task_id === x) stack.push(d.depends_on); }
    setDeps((d) => [...d, { task_id: taskId, depends_on: dependsOn }]);
    const { error } = await db.from('task_dependencies').insert({ task_id: taskId, depends_on: dependsOn });
    if (error) { toast.error('Não foi possível ligar os cards.'); void load(); }
  }, [deps, load]);
  const removeDep = useCallback(async (taskId: string, dependsOn: string) => {
    setDeps((d) => d.filter((x) => !(x.task_id === taskId && x.depends_on === dependsOn)));
    const { error } = await db.from('task_dependencies').delete().eq('task_id', taskId).eq('depends_on', dependsOn);
    if (error) { toast.error('Não foi possível remover a dependência.'); void load(); }
  }, [load]);
  return { approvals, fields, valueOf, setValue, saveField, deleteField, moveField, deps, blockersOf, blockingOf, addDep, removeDep, reload: load };
}

export type BoardExtras = ReturnType<typeof useBoardExtrasState>;
const Ctx = createContext<BoardExtras | null>(null);
export function BoardExtrasProvider({ boardId, children }: { boardId: string; children: ReactNode }) {
  const v = useBoardExtrasState(boardId);
  const memo = useMemo(() => v, [v]);
  return <Ctx.Provider value={memo}>{children}</Ctx.Provider>;
}
/** null outside a mural (e.g. a card opened from somewhere else): callers hide the extras. */
export function useBoardExtras() { return useContext(Ctx); }
