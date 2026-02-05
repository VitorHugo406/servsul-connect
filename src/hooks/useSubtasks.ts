import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
}

export function useSubtasks(taskId: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) { setSubtasks([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('position', { ascending: true });
      if (error) throw error;
      setSubtasks((data || []) as Subtask[]);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchSubtasks(); }, [fetchSubtasks]);

  const addSubtask = async (title: string) => {
    if (!taskId) return { error: new Error('No task') };
    try {
      const { error } = await supabase.from('task_subtasks').insert({
        task_id: taskId,
        title,
        position: subtasks.length,
      });
      if (error) throw error;
      await fetchSubtasks();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const toggleSubtask = async (id: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('task_subtasks')
        .update({ is_completed: completed })
        .eq('id', id);
      if (error) throw error;
      setSubtasks(prev => prev.map(s => s.id === id ? { ...s, is_completed: completed } : s));
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteSubtask = async (id: string) => {
    try {
      const { error } = await supabase.from('task_subtasks').delete().eq('id', id);
      if (error) throw error;
      await fetchSubtasks();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const completed = subtasks.filter(s => s.is_completed).length;
  const total = subtasks.length;

  return { subtasks, loading, addSubtask, toggleSubtask, deleteSubtask, completed, total, refetch: fetchSubtasks };
}

// Lightweight hook to get subtask counts for multiple tasks at once (for card indicators)
export function useSubtaskCounts(taskIds: string[]) {
  const [counts, setCounts] = useState<Record<string, { completed: number; total: number }>>({});

  const fetchCounts = useCallback(async () => {
    if (taskIds.length === 0) { setCounts({}); return; }
    try {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('task_id, is_completed')
        .in('task_id', taskIds);
      if (error) throw error;
      const map: Record<string, { completed: number; total: number }> = {};
      (data || []).forEach(s => {
        if (!map[s.task_id]) map[s.task_id] = { completed: 0, total: 0 };
        map[s.task_id].total++;
        if (s.is_completed) map[s.task_id].completed++;
      });
      setCounts(map);
    } catch (error) {
      console.error('Error fetching subtask counts:', error);
    }
  }, [taskIds.join(',')]);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  return { counts, refetch: fetchCounts };
}
