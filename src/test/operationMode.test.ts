import { describe, expect, it } from 'vitest';
import { planOperation, type OpTask } from '@/lib/operationMode';

const now = new Date('2026-11-09T12:00:00Z');
const t = (id: string, p: OpTask['priority'], pos: number, extra: Partial<OpTask> = {}): OpTask => ({ id, task_number: pos + 1, title: id, status: 'c1', priority: p, due_date: null, position: pos, ...extra });
const cols = [{ id: 'c1', title: 'A fazer' }, { id: 'done', title: 'Concluído', is_conclusion: true }];
const order = (plan: ReturnType<typeof planOperation>, tasks: OpTask[]) => {
  const pos = new Map(tasks.map((x) => [x.id, x.position]));
  plan.moves.forEach((m) => pos.set(m.id, m.position));
  return tasks.filter((x) => x.status === 'c1').sort((a, b) => pos.get(a.id)! - pos.get(b.id)!).map((x) => x.id);
};

describe('planOperation', () => {
  it('orders by priority', () => {
    const tasks = [t('low', 'low', 0), t('urg', 'urgent', 1), t('med', 'medium', 2)];
    expect(order(planOperation(tasks, cols, { priority: true, deadline: false, urgency: false }, now), tasks)).toEqual(['urg', 'med', 'low']);
  });
  it('raises overdue to urgent and due-soon to high, then sorts by deadline', () => {
    const tasks = [t('a', 'low', 0, { due_date: '2026-11-08T12:00:00Z' }), t('b', 'medium', 1, { due_date: '2026-11-10T12:00:00Z' }), t('c', 'high', 2)];
    const plan = planOperation(tasks, cols, { priority: true, deadline: true, urgency: false }, now);
    expect(plan.priorityChanges.map((x) => [x.id, x.to])).toEqual([['a', 'urgent'], ['b', 'high']]);
    expect(order(plan, tasks)).toEqual(['a', 'b', 'c']);
  });
  it('never touches the conclusion column, archived, templates or finished cards', () => {
    const tasks = [t('fin', 'low', 0, { completed_at: '2026-11-01T00:00:00Z', due_date: '2026-10-01T00:00:00Z' }), t('x', 'urgent', 1), t('tpl', 'urgent', 2, { is_template: true }), t('d', 'low', 0, { status: 'done', due_date: '2026-10-01T00:00:00Z' })];
    const plan = planOperation(tasks, cols, { priority: true, deadline: true, urgency: true }, now);
    expect(plan.priorityChanges).toEqual([]);
    expect(plan.moves.find((m) => m.id === 'd')).toBeUndefined();
    expect(order(plan, tasks)).toEqual(['x', 'fin', 'tpl']);
  });
  it('emergency cards stay on top and an ordered board needs no moves', () => {
    const tasks = [t('em', 'low', 0, { is_emergency: true }), t('u', 'urgent', 1)];
    const plan = planOperation(tasks, cols, { priority: true, deadline: false, urgency: false }, now);
    expect(plan.moves).toEqual([]);
    expect(plan.columns[0].moved).toBe(0);
  });
});
