import { useState, useEffect, useCallback, useMemo } from 'react';
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

const labelCache = new Map<string, { labels: TaskLabel[]; assignments: TaskLabelAssignment[] }>();
type LabelAssignmentJoin = TaskLabelAssignment & { label?: { board_id: string } | null };

export function useTaskLabels(boardId: string | null) {
  const [labels, setLabels] = useState<TaskLabel[]>(() => (boardId ? labelCache.get(boardId)?.labels || [] : []));
  const [assignments, setAssignments] = useState<TaskLabelAssignment[]>(() => (boardId ? labelCache.get(boardId)?.assignments || [] : []));
  const [loading, setLoading] = useState(() => (boardId ? !labelCache.has(boardId) : false));

  const fetchLabels = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_labels')
        .select('*')
        .eq('board_id', boardId)
        .order('name');
      if (error) throw error;
      const next = (data || []) as TaskLabel[];
      setLabels(next);
      labelCache.set(boardId, { labels: next, assignments: labelCache.get(boardId)?.assignments || [] });
    } catch (error) {
      console.error('Error fetching labels:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const fetchAssignments = useCallback(async () => {
    if (!boardId) return;
    try {
      const { data, error } = await supabase
        .from('task_label_assignments')
        .select('*, label:task_labels!inner(board_id)')
        .eq('label.board_id', boardId);
      if (error) throw error;
      const next = ((data || []) as unknown as LabelAssignmentJoin[]).map(({ label: _label, ...assignment }) => assignment);
      setAssignments(next);
      labelCache.set(boardId, { labels: labelCache.get(boardId)?.labels || [], assignments: next });
    } catch (error) {
      console.error('Error fetching label assignments:', error);
    }
  }, [boardId]);

  useEffect(() => {
    if (boardId && labelCache.has(boardId)) {
      const cached = labelCache.get(boardId)!;
      setLabels(cached.labels);
      setAssignments(cached.assignments);
      setLoading(false);
    }
    fetchLabels();
    fetchAssignments();
  }, [boardId, fetchLabels, fetchAssignments]);

  const assignmentsByTask = useMemo(() => {
    const map = new Map<string, Set<string>>();
    assignments.forEach((assignment) => {
      if (!map.has(assignment.task_id)) map.set(assignment.task_id, new Set());
      map.get(assignment.task_id)!.add(assignment.label_id);
    });
    return map;
  }, [assignments]);

  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);

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
    const taskAssignments = assignmentsByTask.get(taskId);
    if (!taskAssignments) return [];
    return Array.from(taskAssignments)
      .map((labelId) => labelById.get(labelId))
      .filter(Boolean) as TaskLabel[];
  }, [assignmentsByTask, labelById]);

  return {
    labels, assignments, loading,
    createLabel, updateLabel, deleteLabel,
    assignLabel, removeLabel, getTaskLabels,
    refetch: () => { fetchLabels(); fetchAssignments(); },
  };
}
