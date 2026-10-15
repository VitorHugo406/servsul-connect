import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ColumnAutoSubtask {
  id: string;
  column_id: string;
  group_title: string;
  title: string;
  position: number;
  created_at: string;
}

export function useColumnAutoSubtasks(columnId: string | null) {
  const [autoSubtasks, setAutoSubtasks] = useState<ColumnAutoSubtask[]>([]);

  const fetchAutoSubtasks = useCallback(async () => {
    if (!columnId) { setAutoSubtasks([]); return; }
    try {
      const { data, error } = await supabase
        .from('column_auto_subtasks')
        .select('*')
        .eq('column_id', columnId)
        .order('group_title', { ascending: true })
        .order('position', { ascending: true });
      if (error) throw error;
      setAutoSubtasks((data || []) as ColumnAutoSubtask[]);
    } catch (error) {
      console.error('Error fetching column auto subtasks:', error);
    }
  }, [columnId]);

  useEffect(() => { fetchAutoSubtasks(); }, [fetchAutoSubtasks]);

  const addAutoSubtask = async (groupTitle: string, title: string) => {
    if (!columnId) return { error: new Error('No column') };
    try {
      const { error } = await supabase.from('column_auto_subtasks').insert({
        column_id: columnId,
        group_title: groupTitle,
        title,
        position: autoSubtasks.filter(s => s.group_title === groupTitle).length,
      });
      if (error) throw error;
      await fetchAutoSubtasks();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteAutoSubtask = async (id: string) => {
    try {
      const { error } = await supabase.from('column_auto_subtasks').delete().eq('id', id);
      if (error) throw error;
      await fetchAutoSubtasks();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Apply auto-subtasks to a task (create groups and subtasks)
  const applyToTask = async (taskId: string) => {
    if (autoSubtasks.length === 0) return;
    
    // Group by group_title
    const groups = new Map<string, ColumnAutoSubtask[]>();
    autoSubtasks.forEach(s => {
      if (!groups.has(s.group_title)) groups.set(s.group_title, []);
      groups.get(s.group_title)!.push(s);
    });

    let groupPos = 0;
    for (const [groupTitle, items] of groups) {
      // Create subtask group
      const { data: group } = await supabase.from('subtask_groups').insert({
        task_id: taskId,
        title: groupTitle,
        position: groupPos++,
      }).select().single();

      // Create subtasks in the group
      if (group) {
        const subtasks = items.map((item, idx) => ({
          task_id: taskId,
          title: item.title,
          position: idx,
          group_id: group.id,
        }));
        await supabase.from('task_subtasks').insert(subtasks);
      }
    }
  };

  return { autoSubtasks, addAutoSubtask, deleteAutoSubtask, applyToTask, refetch: fetchAutoSubtasks };
}
