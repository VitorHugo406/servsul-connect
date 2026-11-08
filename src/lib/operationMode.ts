// "Modo Operação" of the task boards: computes, in one pass, how each column should be ordered
// and which priorities should go up because of deadlines. Pure function (tested), the panel only
// applies the resulting changes.
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export interface OpTask {
  id: string; task_number: number; title: string; status: string; priority: Priority; due_date: string | null;
  position: number; is_archived?: boolean; is_template?: boolean; completed_at?: string | null; is_emergency?: boolean;
}
export interface OpColumn { id: string; title: string; is_conclusion?: boolean | null }
export interface OpCriteria { priority: boolean; deadline: boolean; urgency: boolean }
export interface OpPlan {
  priorityChanges: { id: string; number: number; title: string; from: Priority; to: Priority; reason: 'overdue' | 'soon' }[];
  moves: { id: string; position: number }[];
  columns: { id: string; title: string; moved: number; total: number }[];
}

const RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const SOON_HOURS = 48;

export function planOperation(tasks: OpTask[], columns: OpColumn[], c: OpCriteria, now = new Date()): OpPlan {
  const useDeadline = c.deadline || c.urgency;
  const usePriority = c.priority || c.urgency;
  const due = (t: OpTask) => (t.due_date ? new Date(t.due_date).getTime() : NaN);
  const open = (t: OpTask) => !t.completed_at;
  const isOverdue = (t: OpTask) => open(t) && Number.isFinite(due(t)) && due(t) < now.getTime();
  const isSoon = (t: OpTask) => open(t) && Number.isFinite(due(t)) && due(t) >= now.getTime() && due(t) - now.getTime() <= SOON_HOURS * 3600e3;

  const plan: OpPlan = { priorityChanges: [], moves: [], columns: [] };
  const newPriority = new Map<string, Priority>();
  if (c.deadline) {
    for (const t of tasks) {
      if (t.is_archived || t.is_template || !open(t)) continue;
      if (columns.find((col) => col.id === t.status)?.is_conclusion) continue;
      if (isOverdue(t) && t.priority !== 'urgent') { newPriority.set(t.id, 'urgent'); plan.priorityChanges.push({ id: t.id, number: t.task_number, title: t.title, from: t.priority, to: 'urgent', reason: 'overdue' }); }
      else if (isSoon(t) && RANK[t.priority] > RANK.high) { newPriority.set(t.id, 'high'); plan.priorityChanges.push({ id: t.id, number: t.task_number, title: t.title, from: t.priority, to: 'high', reason: 'soon' }); }
    }
  }
  const prio = (t: OpTask) => RANK[newPriority.get(t.id) ?? t.priority] ?? RANK.medium;

  for (const col of columns) {
    if (col.is_conclusion) continue;
    const inCol = tasks.filter((t) => t.status === col.id && !t.is_archived).sort((a, b) => a.position - b.position);
    const active = inCol.filter((t) => !t.is_template);
    const templates = inCol.filter((t) => t.is_template);
    const sorted = [...active].sort((a, b) => {
      if (open(a) !== open(b)) return open(a) ? -1 : 1; // finished cards that were not moved yet go last
      if (!!a.is_emergency !== !!b.is_emergency) return a.is_emergency ? -1 : 1;
      if (useDeadline && isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      if (usePriority && prio(a) !== prio(b)) return prio(a) - prio(b);
      if (useDeadline) {
        const da = due(a), db = due(b);
        if (Number.isFinite(da) !== Number.isFinite(db)) return Number.isFinite(da) ? -1 : 1;
        if (Number.isFinite(da) && da !== db) return da - db;
      }
      return a.position - b.position;
    });
    let moved = 0;
    [...sorted, ...templates].forEach((t, i) => { if (t.position !== i) { plan.moves.push({ id: t.id, position: i }); if (!t.is_template) moved++; } });
    plan.columns.push({ id: col.id, title: col.title, moved, total: active.length });
  }
  return plan;
}
