import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AutomationRule {
  id: string;
  board_id: string;
  task_id: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export const TRIGGER_TYPES = [
  { id: 'deadline_approaching', label: 'Prazo se aproximando', description: 'Quando o prazo estiver a X horas' },
  { id: 'stuck_days', label: 'Card parado', description: 'Quando o card ficar parado por X dias' },
  { id: 'checklist_complete', label: 'Checklist 100%', description: 'Quando a checklist atingir 100%' },
  { id: 'label_urgent', label: 'Etiqueta "Urgente"', description: 'Quando a etiqueta urgente for aplicada' },
];

export const ACTION_TYPES = [
  { id: 'notify', label: 'Notificar responsável', description: 'Envia notificação ao responsável do card' },
  { id: 'move_column', label: 'Mover para coluna', description: 'Move o card para uma coluna específica' },
  { id: 'set_priority', label: 'Alterar prioridade', description: 'Altera a prioridade do card' },
  { id: 'alert', label: 'Gerar alerta', description: 'Gera alerta visível na Gestão de Pessoas' },
];

export function useAutomationRules(boardId: string | null) {
  const { profile } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_automation_rules')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRules((data || []) as AutomationRule[]);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (rule: {
    task_id?: string;
    trigger_type: string;
    trigger_config: Record<string, any>;
    action_type: string;
    action_config: Record<string, any>;
  }) => {
    if (!boardId || !profile) return { error: new Error('Not ready') };
    try {
      const { data, error } = await supabase
        .from('task_automation_rules')
        .insert({
          board_id: boardId,
          task_id: rule.task_id || null,
          trigger_type: rule.trigger_type,
          trigger_config: rule.trigger_config,
          action_type: rule.action_type,
          action_config: rule.action_config,
          created_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;
      await fetchRules();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('task_automation_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
      await fetchRules();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('task_automation_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);
      if (error) throw error;
      await fetchRules();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const getTaskRules = (taskId: string) => rules.filter(r => r.task_id === taskId);

  return { rules, loading, createRule, deleteRule, toggleRule, getTaskRules, refetch: fetchRules };
}
