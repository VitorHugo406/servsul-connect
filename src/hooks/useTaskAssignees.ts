import { useState, useEffect, useCallback, useMemo } from 'react';
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

const assigneeCache = new Map<string, TaskAssignee[]>();
type TaskAssigneeJoin = TaskAssignee & { task?: { board_id: string } | null };

export function useTaskAssignees(boardId: string | null) {
  const [assignees, setAssignees] = useState<TaskAssignee[]>(() => (boardId ? assigneeCache.get(boardId) || [] : []));

  const fetchAssignees = useCallback(async () => {
    if (!boardId) return;
    const { data } = await supabase
      .from('task_assignees')
      .select('*, task:tasks!inner(board_id), profile:profiles!task_assignees_profile_id_fkey(id, name, display_name, avatar_url)')
      .eq('task.board_id', boardId);
    const next = ((data || []) as unknown as TaskAssigneeJoin[]).map(({ task: _task, ...assignee }) => assignee);
    assigneeCache.set(boardId, next);
    setAssignees(next);
  }, [boardId]);

  useEffect(() => {
    if (boardId && assigneeCache.has(boardId)) setAssignees(assigneeCache.get(boardId) || []);
    fetchAssignees();
    if (!boardId) return;
    const channel = supabase
      .channel(`task-assignees-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => fetchAssignees())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAssignees, boardId]);

  const assigneesByTask = useMemo(() => {
    const map = new Map<string, TaskAssignee[]>();
    assignees.forEach((assignee) => {
      const list = map.get(assignee.task_id) || [];
      list.push(assignee);
      map.set(assignee.task_id, list);
    });
    return map;
  }, [assignees]);

  const getTaskAssignees = useCallback((taskId: string) => {
    return assigneesByTask.get(taskId) || [];
  }, [assigneesByTask]);

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
