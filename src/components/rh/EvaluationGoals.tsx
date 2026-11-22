// Goals inside an evaluation: the evaluated person's goals (RH › Metas) with their progress; the evaluator links the
// ones that count for this evaluation (evaluation_goals keeps the progress of the moment). Migration 20261121010000.
import { useCallback, useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { useDbFeature } from '@/hooks/useDbFeature';
import { db } from './rhShared';
import { goalPct } from './GoalsTab';

type G = Parameters<typeof goalPct>[0];

export function EvaluationGoals({ evaluationId, personId, editable }: { evaluationId: string; personId: string; editable: boolean }) {
  const has = useDbFeature('evaluation_goals');
  const [goals, setGoals] = useState<G[]>([]);
  const [linked, setLinked] = useState<Map<string, number | null>>(new Map());
  const load = useCallback(async () => {
    const [{ data: g }, { data: l }] = await Promise.all([
      db.from('goals').select('*').eq('profile_id', personId).neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false }),
      db.from('evaluation_goals').select('goal_id,progress').eq('evaluation_id', evaluationId),
    ]);
    setGoals(g || []); setLinked(new Map(((l || []) as { goal_id: string; progress: number | null }[]).map((x) => [x.goal_id, x.progress])));
  }, [evaluationId, personId]);
  useEffect(() => { if (has) void load(); }, [has, load]);
  if (!has || (!goals.length && !linked.size)) return null;
  const toggle = async (g: G) => {
    const on = linked.has(g.id);
    const { error } = on ? await db.from('evaluation_goals').delete().eq('evaluation_id', evaluationId).eq('goal_id', g.id) : await db.from('evaluation_goals').insert({ evaluation_id: evaluationId, goal_id: g.id, progress: goalPct(g) });
    if (error) toast.error('Só quem avalia pode vincular metas.'); else void load();
  };
  return (
    <div className="space-y-2 rounded-2xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Target className="h-4 w-4" />Metas da pessoa</p>
      <div className="flex flex-col gap-1.5">
        {goals.map((g) => { const pct = goalPct(g); const on = linked.has(g.id); return (
          <label key={g.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-muted/50">
            {editable ? <input type="checkbox" checked={on} onChange={() => void toggle(g)} aria-label={`Considerar a meta ${g.title} nesta avaliação`} /> : null}
            <span className="min-w-0 flex-1 truncate">{g.title}</span>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
            <b className="w-10 text-right text-xs">{pct}%</b>
            {on && !editable ? <span className="text-[11px] text-muted-foreground">considerada</span> : null}
          </label>); })}
      </div>
      {editable ? <p className="text-xs text-muted-foreground">Marque as metas que entram nesta avaliação. O progresso do momento fica guardado com ela.</p> : null}
    </div>
  );
}
