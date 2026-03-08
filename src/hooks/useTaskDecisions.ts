import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskDecision {
  id: string;
  task_id: string;
  decision_text: string;
  responsible_name: string;
  decision_date: string;
  created_by: string;
  created_at: string;
}

export function useTaskDecisions(taskId: string | null) {
  const { profile } = useAuth();
  const [decisions, setDecisions] = useState<TaskDecision[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDecisions = useCallback(async () => {
    if (!taskId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_decisions')
        .select('*')
        .eq('task_id', taskId)
        .order('decision_date', { ascending: false });
      if (error) throw error;
      setDecisions((data || []) as TaskDecision[]);
    } catch (error) {
      console.error('Error fetching decisions:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const addDecision = async (decision: { decision_text: string; responsible_name: string; decision_date: string }) => {
    if (!taskId || !profile) return { error: new Error('Not ready') };
    try {
      const { error } = await supabase
        .from('task_decisions')
        .insert({
          task_id: taskId,
          ...decision,
          created_by: profile.id,
        } as any);
      if (error) throw error;
      await fetchDecisions();
      return { error: null };
    } catch (error) {
      console.error('Error adding decision:', error);
      return { error };
    }
  };

  const deleteDecision = async (id: string) => {
    try {
      const { error } = await supabase.from('task_decisions').delete().eq('id', id);
      if (error) throw error;
      await fetchDecisions();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { decisions, loading, addDecision, deleteDecision };
}
