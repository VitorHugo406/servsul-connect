import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WorkflowRule {
  id: string;
  board_id: string;
  source_column_id: string | null;
  target_column_id: string;
  rule_type: string; // 'block_direct' | 'require_pass'
  required_column_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export function useWorkflowRules(boardId: string | null) {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('column_workflow_rules')
        .select('*')
        .eq('board_id', boardId)
        .eq('is_active', true);
      if (error) throw error;
      setRules((data || []) as WorkflowRule[]);
    } catch (error) {
      console.error('Error fetching workflow rules:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const addRule = async (rule: Omit<WorkflowRule, 'id' | 'created_at' | 'is_active'>) => {
    try {
      const { error } = await supabase.from('column_workflow_rules').insert(rule);
      if (error) throw error;
      await fetchRules();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase.from('column_workflow_rules').delete().eq('id', id);
      if (error) throw error;
      await fetchRules();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Check if a card can move from sourceCol to targetCol
  const canMoveToColumn = (sourceColumnId: string, targetColumnId: string, taskHistory?: string[]): { allowed: boolean; reason?: string } => {
    const activeRules = rules.filter(r => r.is_active);
    
    for (const rule of activeRules) {
      if (rule.rule_type === 'block_direct') {
        // Block moving directly to target from any or specific source
        if (rule.target_column_id === targetColumnId) {
          if (!rule.source_column_id || rule.source_column_id === sourceColumnId) {
            // Check if required column was passed
            if (rule.required_column_id) {
              // For now, we block unless the source IS the required column
              if (sourceColumnId !== rule.required_column_id) {
                return { allowed: false, reason: `Obrigatório passar pela coluna intermediária antes` };
              }
            } else {
              return { allowed: false, reason: `Movimento direto para esta coluna está bloqueado` };
            }
          }
        }
      }
    }
    return { allowed: true };
  };

  return { rules, loading, addRule, deleteRule, canMoveToColumn, refetch: fetchRules };
}
