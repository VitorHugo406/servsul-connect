import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TaskAssignee {
  id: string;
  task_id: string;
  profile_id: string;
  profile?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskAssignees(boardId: string | null) {
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);

  const fetchAssignees = useCallback(async () => {
    if (!boardId) return;
    const { data } = await supabase
      .from('task_assignees')
      .select('*, profile:profiles!task_assignees_profile_id_fkey(id, name, display_name, avatar_url)')
      .in('task_id', (await supabase.from('tasks').select('id').eq('board_id', boardId)).data?.map(t => t.id) || []);
    setAssignees((data || []) as TaskAssignee[]);
  }, [boardId]);

  useEffect(() => {
    fetchAssignees();
    if (!boardId) return;
    const channel = supabase
      .channel(`task-assignees-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => fetchAssignees())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAssignees, boardId]);

  const getTaskAssignees = useCallback((taskId: string) => {
    return assignees.filter(a => a.task_id === taskId);
  }, [assignees]);

  const addAssignee = async (taskId: string, profileId: string) => {
    const { error } = await supabase.from('task_assignees').insert({ task_id: taskId, profile_id: profileId });
    if (!error) fetchAssignees();
    return { error };
  };

  const removeAssignee = async (taskId: string, profileId: string) => {
    const { error } = await supabase.from('task_assignees').delete().eq('task_id', taskId).eq('profile_id', profileId);
    if (!error) fetchAssignees();
    return { error };
  };

  const setTaskAssignees = async (taskId: string, profileIds: string[]) => {
    // Delete all existing
    await supabase.from('task_assignees').delete().eq('task_id', taskId);
    // Insert new
    if (profileIds.length > 0) {
      await supabase.from('task_assignees').insert(profileIds.map(pid => ({ task_id: taskId, profile_id: pid })));
    }
    fetchAssignees();
  };

  return { assignees, getTaskAssignees, addAssignee, removeAssignee, setTaskAssignees, refetch: fetchAssignees };
}
