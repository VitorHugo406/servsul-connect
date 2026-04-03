import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EvalPosition {
  id: string;
  name: string;
  sector_id: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface EvalCompetency {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface EvalPositionCompetency {
  id: string;
  position_id: string;
  competency_id: string;
  weight: number;
  min_expected_score: number | null;
  requires_comment: boolean;
  competency?: EvalCompetency;
}

export interface EvalCycle {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_by: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  cycle_id: string | null;
  evaluator_id: string;
  evaluated_id: string;
  position_id: string | null;
  status: string;
  overall_comment: string | null;
  overall_score: number | null;
  evaluated_comment: string | null;
  evaluator_response: string | null;
  sent_at: string | null;
  responded_at: string | null;
  finalized_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  // joined
  evaluator_name?: string;
  evaluated_name?: string;
  position_name?: string;
  cycle_name?: string;
}

export interface EvaluationItem {
  id: string;
  evaluation_id: string;
  competency_id: string;
  score: number | null;
  weight: number;
  evaluator_comment: string | null;
  evaluated_response: string | null;
  evaluator_reply: string | null;
  classification: string | null;
  competency_name?: string;
  competency_category?: string;
}

export function classifyScore(score: number | null): string {
  if (!score) return '';
  if (score <= 2) return 'needs_improvement';
  if (score === 3) return 'good';
  return 'excellent';
}

export function classifyLabel(classification: string): string {
  switch (classification) {
    case 'needs_improvement': return 'Precisa Melhorar';
    case 'good': return 'Bom';
    case 'excellent': return 'Excelente';
    default: return '';
  }
}

export function classifyColor(classification: string): string {
  switch (classification) {
    case 'needs_improvement': return 'text-destructive';
    case 'good': return 'text-amber-600';
    case 'excellent': return 'text-green-600';
    default: return 'text-muted-foreground';
  }
}

export const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  in_progress: 'Em Preenchimento',
  sent: 'Enviada para Ciência',
  approved: 'Aprovada',
  approved_with_obs: 'Aprovada com Observação',
  contested: 'Devolvida com Observações',
  in_review: 'Em Revisão',
  finalized: 'Finalizada',
  archived: 'Arquivada',
};

export const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  approved_with_obs: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  contested: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  in_review: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  finalized: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  archived: 'bg-muted text-muted-foreground',
};

export function useEvaluations() {
  const { profile, isAdmin } = useAuth();
  const [positions, setPositions] = useState<EvalPosition[]>([]);
  const [competencies, setCompetencies] = useState<EvalCompetency[]>([]);
  const [cycles, setCycles] = useState<EvalCycle[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [posRes, compRes, cycRes, evalRes] = await Promise.all([
        supabase.from('eval_positions').select('*').eq('is_active', true).order('name'),
        supabase.from('eval_competencies').select('*').eq('is_active', true).order('name'),
        supabase.from('eval_cycles').select('*').order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*').order('created_at', { ascending: false }),
      ]);

      setPositions((posRes.data as any[]) || []);
      setCompetencies((compRes.data as any[]) || []);
      setCycles((cycRes.data as any[]) || []);

      // Enrich evaluations with names
      const evals = (evalRes.data as any[]) || [];
      if (evals.length > 0) {
        const profileIds = [...new Set(evals.flatMap(e => [e.evaluator_id, e.evaluated_id]))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name')
          .in('id', profileIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name || p.name]));
        const posMap = new Map((posRes.data as any[] || []).map(p => [p.id, p.name]));
        const cycMap = new Map((cycRes.data as any[] || []).map(c => [c.id, c.name]));

        setEvaluations(evals.map(e => ({
          ...e,
          evaluator_name: profileMap.get(e.evaluator_id) || 'Desconhecido',
          evaluated_name: profileMap.get(e.evaluated_id) || 'Desconhecido',
          position_name: e.position_id ? posMap.get(e.position_id) : null,
          cycle_name: e.cycle_id ? cycMap.get(e.cycle_id) : null,
        })));
      } else {
        setEvaluations([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // CRUD operations
  const createPosition = async (data: { name: string; sector_id?: string; description?: string }) => {
    if (!profile) return;
    const { error } = await supabase.from('eval_positions').insert({ ...data, created_by: profile.user_id });
    if (error) { toast.error('Erro ao criar cargo.'); return; }
    toast.success('Cargo criado!');
    fetchData();
  };

  const createCompetency = async (data: { name: string; description?: string; category: string }) => {
    if (!profile) return;
    const { error } = await supabase.from('eval_competencies').insert({ ...data, created_by: profile.user_id });
    if (error) { toast.error('Erro ao criar competência.'); return; }
    toast.success('Competência criada!');
    fetchData();
  };

  const createCycle = async (data: { name: string; start_date: string; end_date: string; description?: string }) => {
    if (!profile) return;
    const { error } = await supabase.from('eval_cycles').insert({ ...data, created_by: profile.user_id });
    if (error) { toast.error('Erro ao criar ciclo.'); return; }
    toast.success('Ciclo criado!');
    fetchData();
  };

  const createEvaluation = async (data: { evaluated_id: string; cycle_id?: string; position_id?: string }) => {
    if (!profile) return null;
    const { data: newEval, error } = await supabase
      .from('evaluations')
      .insert({ evaluator_id: profile.id, ...data })
      .select()
      .single();

    if (error) { toast.error('Erro ao criar avaliação.'); return null; }

    // Log history
    await supabase.from('evaluation_history').insert({
      evaluation_id: newEval.id,
      action: 'created',
      performed_by: profile.user_id,
      new_status: 'draft',
    });

    toast.success('Avaliação criada!');
    fetchData();
    return newEval;
  };

  const updateEvaluation = async (id: string, updates: Partial<Evaluation>) => {
    if (!profile) return;
    const { error } = await supabase.from('evaluations').update(updates).eq('id', id);
    if (error) { toast.error('Erro ao atualizar avaliação.'); return; }
    fetchData();
  };

  const sendEvaluation = async (id: string) => {
    if (!profile) return;
    const { error } = await supabase.from('evaluations').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro ao enviar avaliação.'); return; }

    await supabase.from('evaluation_history').insert({
      evaluation_id: id, action: 'sent', performed_by: profile.user_id,
      old_status: 'in_progress', new_status: 'sent',
    });

    toast.success('Avaliação enviada para ciência do colaborador.');
    fetchData();
  };

  const approveEvaluation = async (id: string, comment?: string) => {
    if (!profile) return;
    const status = comment ? 'approved_with_obs' : 'approved';
    const { error } = await supabase.from('evaluations').update({
      status, evaluated_comment: comment || null, responded_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error('Erro ao aprovar avaliação.'); return; }

    await supabase.from('evaluation_history').insert({
      evaluation_id: id, action: 'approved', performed_by: profile.user_id,
      old_status: 'sent', new_status: status, details: comment,
    });

    toast.success('Avaliação aprovada!');
    fetchData();
  };

  const contestEvaluation = async (id: string, comment: string) => {
    if (!profile) return;
    const { error } = await supabase.from('evaluations').update({
      status: 'contested', evaluated_comment: comment, responded_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error('Erro ao contestar avaliação.'); return; }

    await supabase.from('evaluation_history').insert({
      evaluation_id: id, action: 'contested', performed_by: profile.user_id,
      old_status: 'sent', new_status: 'contested', details: comment,
    });

    toast.success('Avaliação devolvida com observações.');
    fetchData();
  };

  const respondToContestation = async (id: string, response: string) => {
    if (!profile) return;
    const { error } = await supabase.from('evaluations').update({
      status: 'sent', evaluator_response: response, version: evaluations.find(e => e.id === id)?.version! + 1,
      sent_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error('Erro ao responder.'); return; }

    await supabase.from('evaluation_history').insert({
      evaluation_id: id, action: 'reviewed', performed_by: profile.user_id,
      old_status: 'contested', new_status: 'sent', details: response,
    });

    toast.success('Retorno enviado.');
    fetchData();
  };

  const finalizeEvaluation = async (id: string) => {
    if (!profile) return;
    const { error } = await supabase.from('evaluations').update({
      status: 'finalized', finalized_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) { toast.error('Erro ao finalizar.'); return; }

    await supabase.from('evaluation_history').insert({
      evaluation_id: id, action: 'finalized', performed_by: profile.user_id,
      new_status: 'finalized',
    });

    toast.success('Avaliação finalizada!');
    fetchData();
  };

  // Items
  const fetchEvaluationItems = async (evaluationId: string): Promise<EvaluationItem[]> => {
    const { data } = await supabase
      .from('evaluation_items')
      .select('*')
      .eq('evaluation_id', evaluationId)
      .order('created_at');

    const items = (data as any[]) || [];
    if (items.length === 0) return [];

    const compIds = items.map(i => i.competency_id);
    const { data: comps } = await supabase.from('eval_competencies').select('id, name, category').in('id', compIds);
    const compMap = new Map((comps || []).map(c => [c.id, c]));

    return items.map(i => ({
      ...i,
      competency_name: compMap.get(i.competency_id)?.name || '',
      competency_category: compMap.get(i.competency_id)?.category || '',
    }));
  };

  const saveEvaluationItems = async (evaluationId: string, items: { competency_id: string; score: number | null; weight: number; evaluator_comment?: string }[]) => {
    // Delete existing items then insert new ones
    await supabase.from('evaluation_items').delete().eq('evaluation_id', evaluationId);
    const toInsert = items.map(item => ({
      evaluation_id: evaluationId,
      competency_id: item.competency_id,
      score: item.score,
      weight: item.weight,
      evaluator_comment: item.evaluator_comment || null,
      classification: classifyScore(item.score),
    }));
    const { error } = await supabase.from('evaluation_items').insert(toInsert);
    if (error) { toast.error('Erro ao salvar itens.'); return; }

    // Calculate overall score
    const validItems = toInsert.filter(i => i.score != null);
    if (validItems.length > 0) {
      const totalWeight = validItems.reduce((s, i) => s + i.weight, 0);
      const weightedScore = validItems.reduce((s, i) => s + (i.score! * i.weight), 0);
      const overall = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) / 100 : 0;
      await supabase.from('evaluations').update({ overall_score: overall }).eq('id', evaluationId);
    }
  };

  // Position competencies
  const fetchPositionCompetencies = async (positionId: string): Promise<EvalPositionCompetency[]> => {
    const { data } = await supabase
      .from('eval_position_competencies')
      .select('*')
      .eq('position_id', positionId);

    const items = (data as any[]) || [];
    if (items.length === 0) return [];

    const compIds = items.map(i => i.competency_id);
    const { data: comps } = await supabase.from('eval_competencies').select('*').in('id', compIds);
    const compMap = new Map((comps || []).map(c => [c.id, c]));

    return items.map(i => ({ ...i, competency: compMap.get(i.competency_id) }));
  };

  const savePositionCompetencies = async (positionId: string, items: { competency_id: string; weight: number; min_expected_score?: number; requires_comment?: boolean }[]) => {
    await supabase.from('eval_position_competencies').delete().eq('position_id', positionId);
    const toInsert = items.map(i => ({ position_id: positionId, ...i }));
    const { error } = await supabase.from('eval_position_competencies').insert(toInsert);
    if (error) { toast.error('Erro ao salvar competências do cargo.'); return; }
    toast.success('Competências salvas!');
  };

  return {
    positions, competencies, cycles, evaluations, loading,
    createPosition, createCompetency, createCycle,
    createEvaluation, updateEvaluation, sendEvaluation,
    approveEvaluation, contestEvaluation, respondToContestation, finalizeEvaluation,
    fetchEvaluationItems, saveEvaluationItems,
    fetchPositionCompetencies, savePositionCompetencies,
    refreshData: fetchData,
  };
}
