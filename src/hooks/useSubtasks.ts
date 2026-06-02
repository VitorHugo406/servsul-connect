import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  group_id: string | null;
}

export function useSubtasks(taskId: string | null, boardId?: string | null) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const triggerAutomationsForBoard = useCallback(async () => {
    const bid = boardIdRef.current;
    if (!bid) return;
    try {
      await supabase.functions.invoke('process-automations', {
        body: { board_id: bid },
      });
    } catch (err) {
      console.error('Error triggering automations from subtask:', err);
    }
  }, []);

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

  const addSubtask = async (title: string, groupId?: string | null) => {
    if (!taskId) return { error: new Error('No task') };
    try {
      const sameGroup = subtasks.filter(s => s.group_id === (groupId || null));
      const { error } = await supabase.from('task_subtasks').insert({
        task_id: taskId,
        title,
        position: sameGroup.length,
        group_id: groupId || null,
      });
      if (error) throw error;
      await fetchSubtasks();
      triggerAutomationsForBoard();
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
      triggerAutomationsForBoard();
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
      triggerAutomationsForBoard();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateSubtask = async (id: string, updates: { title?: string; group_id?: string | null; position?: number }) => {
    try {
      // Optimistic update
      setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } as Subtask : s));
      const { error } = await supabase.from('task_subtasks').update(updates).eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      await fetchSubtasks();
      return { error };
    }
  };

  // Persist new ordering for a list of subtasks in parallel
  const reorderSubtasks = async (orderedIds: string[], groupId: string | null) => {
    // optimistic
    setSubtasks(prev => {
      const map = new Map(prev.map(s => [s.id, s]));
      const updated = orderedIds.map((id, i) => {
        const s = map.get(id);
        return s ? { ...s, position: i, group_id: groupId } : s;
      }).filter(Boolean) as Subtask[];
      const others = prev.filter(s => !orderedIds.includes(s.id));
      return [...others, ...updated];
    });
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('task_subtasks').update({ position: i, group_id: groupId }).eq('id', id)
      )
    );
  };

  const completed = subtasks.filter(s => s.is_completed).length;
  const total = subtasks.length;

  return { subtasks, loading, addSubtask, toggleSubtask, deleteSubtask, updateSubtask, reorderSubtasks, completed, total, refetch: fetchSubtasks };
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
