import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface BoardTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  created_by: string;
  sector_id: string | null;
  board_id: string | null;
  cover_image: string | null;
  due_date: string | null;
  position: number;
  is_archived: boolean;
  is_template: boolean;
  completed_at: string | null;
  completed_late: boolean | null;
  delay_days: number | null;
  is_emergency: boolean;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Debounced/coalesced automation trigger — one call per board within a window
const automationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const triggerAutomations = (boardId: string, delay = 1500) => {
  const existing = automationTimers.get(boardId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(async () => {
    automationTimers.delete(boardId);
    try {
      await supabase.functions.invoke('process-automations', {
        body: { board_id: boardId },
      });
    } catch (err) {
      console.error('Error triggering automations:', err);
    }
  }, delay);
  automationTimers.set(boardId, t);
};

export function useBoardTasks(boardId: string | null, restrictTaskId?: string | null) {
  const { profile } = useAuth();
  const [allTasks, setAllTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const fetchTasks = useCallback(async () => {
    if (!boardId) {
      setAllTasks([]);
      setLoading(false);
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, assignee:profiles!tasks_assigned_to_fkey(id, name, display_name, avatar_url)`)
        .eq('board_id', boardId)
        .order('position', { ascending: true });

      if (error) throw error;

      setAllTasks(
        (data || []).map((t) => ({
          ...t,
          is_archived: t.is_archived ?? false,
          is_template: t.is_template ?? false,
          is_emergency: (t as any).is_emergency ?? false,
        })) as BoardTask[]
      );
    } catch (error) {
      console.error('Error fetching board tasks:', error);
      setAllTasks([]);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [boardId]);

  // Debounced refetch to coalesce realtime bursts
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      fetchTasks();
    }, 400);
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
    if (!boardId) return;

    const channel = supabase
      .channel(`board-tasks-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` }, () => scheduleRefetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [fetchTasks, boardId]);

  const createTask = async (task: {
    title: string;
    description?: string;
    status: string;
    priority?: string;
    assigned_to?: string;
    due_date?: string;
    cover_image?: string;
  }) => {
    if (!profile || !boardId) return { error: new Error('Not ready') };

    const tasksInCol = allTasks.filter((t) => t.status === task.status && !t.is_archived);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          board_id: boardId,
          created_by: profile.id,
          priority: task.priority || 'medium',
          position: tasksInCol.length,
        })
        .select()
        .single();

      if (error) throw error;
      if (boardId) triggerAutomations(boardId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const updateTask = async (id: string, updates: Partial<BoardTask>) => {
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
      if (boardId) triggerAutomations(boardId);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const moveTask = async (taskId: string, newStatus: string, newPosition: number) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, position: newPosition })
        .eq('id', taskId);

      if (error) throw error;

      setAllTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t)));

      if (boardId) triggerAutomations(boardId);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const reorderInColumn = async (taskId: string, newPosition: number) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    const columnTasks = allTasks
      .filter((t) => t.status === task.status && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    columnTasks.splice(newPosition, 0, task);

    // Optimistic UI first — feels instant
    setAllTasks((prev) => {
      const other = prev.filter((t) => t.status !== task.status);
      return [...other, ...columnTasks.map((t, i) => ({ ...t, position: i }))];
    });

    // Persist in parallel instead of sequentially
    await Promise.all(
      columnTasks.map((t, i) =>
        t.position === i ? Promise.resolve() : supabase.from('tasks').update({ position: i }).eq('id', t.id)
      )
    );
  };

  const archiveTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ is_archived: true }).eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const unarchiveTask = async (id: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ is_archived: false }).eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const archiveColumnTasks = async (columnId: string) => {
    try {
      const colTaskIds = allTasks.filter((t) => t.status === columnId && !t.is_archived).map((t) => t.id);
      if (colTaskIds.length === 0) return { error: null };

      const { error } = await supabase.from('tasks').update({ is_archived: true }).in('id', colTaskIds);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const activeTasks = allTasks.filter((t) => !t.is_archived);
  const archivedTasks = allTasks.filter((t) => t.is_archived);

  const visibleActiveTasks = restrictTaskId ? activeTasks.filter((t) => t.id === restrictTaskId) : activeTasks;
  const visibleArchivedTasks = restrictTaskId ? archivedTasks.filter((t) => t.id === restrictTaskId) : archivedTasks;

  return {
    tasks: visibleActiveTasks,
    allTasks,
    archivedTasks: visibleArchivedTasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderInColumn,
    archiveTask,
    unarchiveTask,
    archiveColumnTasks,
    refetch: fetchTasks,
  };
}
