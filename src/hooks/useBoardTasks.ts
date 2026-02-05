import { useState, useEffect, useCallback } from 'react';
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
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useBoardTasks(boardId: string | null) {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, assignee:profiles!tasks_assigned_to_fkey(id, name, display_name, avatar_url)`)
        .eq('board_id', boardId)
        .order('position', { ascending: true });
      if (error) throw error;
      setTasks((data || []) as BoardTask[]);
    } catch (error) {
      console.error('Error fetching board tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchTasks();
    if (!boardId) return;
    const channel = supabase
      .channel(`board-tasks-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    const tasksInCol = tasks.filter(t => t.status === task.status);
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
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const updateTask = async (id: string, updates: Partial<BoardTask>) => {
    try {
      const { error } = await supabase.from('tasks').update(updates).eq('id', id);
      if (error) throw error;
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
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t
      ));
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const reorderInColumn = async (taskId: string, newPosition: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const columnTasks = tasks
      .filter(t => t.status === task.status && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    columnTasks.splice(newPosition, 0, task);

    // Update all positions
    const updates = columnTasks.map((t, i) => ({ id: t.id, position: i }));
    for (const u of updates) {
      await supabase.from('tasks').update({ position: u.position }).eq('id', u.id);
    }

    setTasks(prev => {
      const other = prev.filter(t => t.status !== task.status);
      return [...other, ...columnTasks.map((t, i) => ({ ...t, position: i }))];
    });
  };

  return { tasks, loading, createTask, updateTask, deleteTask, moveTask, reorderInColumn, refetch: fetchTasks };
}
