import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskLabelAssignment {
  id: string;
  task_id: string;
  label_id: string;
  created_at: string;
}

export function useTaskLabels(boardId: string | null) {
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [assignments, setAssignments] = useState<TaskLabelAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_labels')
        .select('*')
        .eq('board_id', boardId)
        .order('name');
      if (error) throw error;
      setLabels((data || []) as TaskLabel[]);
    } catch (error) {
      console.error('Error fetching labels:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const fetchAssignments = useCallback(async () => {
    if (!boardId) return;
    try {
      // Get all task IDs for this board first
      const { data: taskIds } = await supabase
        .from('tasks')
        .select('id')
        .eq('board_id', boardId);
      if (!taskIds || taskIds.length === 0) { setAssignments([]); return; }

      const { data, error } = await supabase
        .from('task_label_assignments')
        .select('*')
        .in('task_id', taskIds.map(t => t.id));
      if (error) throw error;
      setAssignments((data || []) as TaskLabelAssignment[]);
    } catch (error) {
      console.error('Error fetching label assignments:', error);
    }
  }, [boardId]);

  useEffect(() => {
    fetchLabels();
    fetchAssignments();
  }, [fetchLabels, fetchAssignments]);

  const createLabel = async (name: string, color: string) => {
    if (!boardId) return { error: new Error('No board') };
    try {
      const { error } = await supabase.from('task_labels').insert({
        board_id: boardId, name, color,
      });
      if (error) throw error;
      await fetchLabels();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateLabel = async (id: string, updates: Partial<TaskLabel>) => {
    try {
      const { error } = await supabase.from('task_labels').update(updates).eq('id', id);
      if (error) throw error;
      await fetchLabels();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteLabel = async (id: string) => {
    try {
      const { error } = await supabase.from('task_labels').delete().eq('id', id);
      if (error) throw error;
      await fetchLabels();
      await fetchAssignments();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const assignLabel = async (taskId: string, labelId: string) => {
    try {
      const { error } = await supabase.from('task_label_assignments').insert({
        task_id: taskId, label_id: labelId,
      });
      if (error) throw error;
      await fetchAssignments();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const removeLabel = async (taskId: string, labelId: string) => {
    try {
      const { error } = await supabase
        .from('task_label_assignments')
        .delete()
        .eq('task_id', taskId)
        .eq('label_id', labelId);
      if (error) throw error;
      await fetchAssignments();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const getTaskLabels = useCallback((taskId: string) => {
    const taskAssignments = assignments.filter(a => a.task_id === taskId);
    return labels.filter(l => taskAssignments.some(a => a.label_id === l.id));
  }, [assignments, labels]);

  return {
    labels, assignments, loading,
    createLabel, updateLabel, deleteLabel,
    assignLabel, removeLabel, getTaskLabels,
    refetch: () => { fetchLabels(); fetchAssignments(); },
  };
}
