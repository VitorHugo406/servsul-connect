import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubtaskGroup {
  id: string;
  task_id: string;
  title: string;
  position: number;
  created_at: string;
}

export function useSubtaskGroups(taskId: string | null) {
  const [groups, setGroups] = useState<SubtaskGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!taskId) { setGroups([]); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('subtask_groups')
        .select('*')
        .eq('task_id', taskId)
        .order('position', { ascending: true });
      if (error) throw error;
      setGroups((data || []) as SubtaskGroup[]);
    } catch (error) {
      console.error('Error fetching subtask groups:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const addGroup = async (title: string) => {
    if (!taskId) return { error: new Error('No task') };
    try {
      const { error } = await supabase.from('subtask_groups').insert({
        task_id: taskId,
        title,
        position: groups.length,
      });
      if (error) throw error;
      await fetchGroups();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteGroup = async (id: string) => {
    try {
      const { error } = await supabase.from('subtask_groups').delete().eq('id', id);
      if (error) throw error;
      await fetchGroups();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateGroup = async (id: string, title: string) => {
    try {
      const { error } = await supabase.from('subtask_groups').update({ title }).eq('id', id);
      if (error) throw error;
      await fetchGroups();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { groups, loading, addGroup, deleteGroup, updateGroup, refetch: fetchGroups };
}
