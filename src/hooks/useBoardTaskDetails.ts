import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BoardTaskLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface BoardTaskLabelAssignment {
  id: string;
  task_id: string;
  label_id: string;
  created_at: string;
}

export interface BoardTaskAssignee {
  id: string;
  task_id: string;
  profile_id: string;
  profile?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

type SubtaskCounts = Record<string, { completed: number; total: number }>;
type BoardTaskDetails = {
  labels: BoardTaskLabel[];
  label_assignments: BoardTaskLabelAssignment[];
  assignees: BoardTaskAssignee[];
  subtask_counts: SubtaskCounts;
};

const emptyDetails: BoardTaskDetails = {
  labels: [],
  label_assignments: [],
  assignees: [],
  subtask_counts: {},
};

const detailsCache = new Map<string, BoardTaskDetails>();

export function useBoardTaskDetails(boardId: string | null, taskIds: ReadonlySet<string> = new Set()) {
  const [details, setDetails] = useState<BoardTaskDetails>(() => (boardId ? detailsCache.get(boardId) || emptyDetails : emptyDetails));
  const [loading, setLoading] = useState(() => (boardId ? !detailsCache.has(boardId) : false));
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestVersion = useRef(0);
  const taskIdsRef = useRef<ReadonlySet<string>>(taskIds);
  taskIdsRef.current = taskIds;

  const applyDetails = useCallback((next: BoardTaskDetails) => {
    if (boardId) detailsCache.set(boardId, next);
    setDetails(next);
  }, [boardId]);

  const fetchDetails = useCallback(async () => {
    if (!boardId) {
      requestVersion.current += 1;
      setDetails(emptyDetails);
      setLoading(false);
      return;
    }

    const requestId = ++requestVersion.current;
    try {
      const { data, error } = await (supabase as any).rpc('get_board_task_details_fast', { _board_id: boardId });
      if (error) throw error;
      if (requestId !== requestVersion.current) return;
      applyDetails({
        labels: data?.labels || [],
        label_assignments: data?.label_assignments || [],
        assignees: data?.assignees || [],
        subtask_counts: data?.subtask_counts || {},
      });
    } catch (error) {
      console.error('Error fetching board task details:', error);
      if (requestId === requestVersion.current) {
        const cached = detailsCache.get(boardId);
        if (cached) setDetails(cached);
      }
    } finally {
      if (requestId === requestVersion.current) setLoading(false);
    }
  }, [applyDetails, boardId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      fetchDetails();
    }, 350);
  }, [fetchDetails]);

  useEffect(() => {
    if (boardId && detailsCache.has(boardId)) {
      setDetails(detailsCache.get(boardId)!);
      setLoading(false);
    } else {
      // Avoid showing labels/assignees from the previous board during loading.
      setDetails(emptyDetails);
      setLoading(!!boardId);
    }

    fetchDetails();
    if (!boardId) return;

    const handleTaskScopedChange = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const taskId = String(payload.new?.task_id || payload.old?.task_id || '');
      // DELETE payloads may omit non-primary-key columns unless replica identity is FULL.
      // If the task id is unavailable, refresh conservatively to avoid stale details.
      if (!taskId || taskIdsRef.current.has(taskId)) scheduleRefetch();
    };

    const channel = supabase
      .channel(`board-task-details-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels', filter: `board_id=eq.${boardId}` }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_label_assignments' }, handleTaskScopedChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, handleTaskScopedChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_subtasks' }, handleTaskScopedChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [boardId, fetchDetails, scheduleRefetch]);

  const assignmentsByTask = useMemo(() => {
    const map = new Map<string, Set<string>>();
    details.label_assignments.forEach((assignment) => {
      if (!map.has(assignment.task_id)) map.set(assignment.task_id, new Set());
      map.get(assignment.task_id)!.add(assignment.label_id);
    });
    return map;
  }, [details.label_assignments]);

  const labelById = useMemo(() => new Map(details.labels.map((label) => [label.id, label])), [details.labels]);

  const assigneesByTask = useMemo(() => {
    const map = new Map<string, BoardTaskAssignee[]>();
    details.assignees.forEach((assignee) => {
      const list = map.get(assignee.task_id) || [];
      list.push(assignee);
      map.set(assignee.task_id, list);
    });
    return map;
  }, [details.assignees]);

  const getTaskLabels = useCallback((taskId: string) => {
    const taskAssignments = assignmentsByTask.get(taskId);
    if (!taskAssignments) return [];
    return Array.from(taskAssignments)
      .map((labelId) => labelById.get(labelId))
      .filter(Boolean) as BoardTaskLabel[];
  }, [assignmentsByTask, labelById]);

  const getTaskAssignees = useCallback((taskId: string) => assigneesByTask.get(taskId) || [], [assigneesByTask]);

  const createLabel = async (name: string, color: string) => {
    if (!boardId) return { error: new Error('No board') };
    const { error } = await supabase.from('task_labels').insert({ board_id: boardId, name, color });
    if (!error) await fetchDetails();
    return { error };
  };

  const deleteLabel = async (id: string) => {
    const { error } = await supabase.from('task_labels').delete().eq('id', id);
    if (!error) await fetchDetails();
    return { error };
  };

  const assignLabel = async (taskId: string, labelId: string) => {
    const { error } = await supabase.from('task_label_assignments').insert({ task_id: taskId, label_id: labelId });
    if (!error) await fetchDetails();
    return { error };
  };

  const removeLabel = async (taskId: string, labelId: string) => {
    const { error } = await supabase.from('task_label_assignments').delete().eq('task_id', taskId).eq('label_id', labelId);
    if (!error) await fetchDetails();
    return { error };
  };

  const setTaskAssignees = async (taskId: string, profileIds: string[]) => {
    const { error: deleteError } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
    if (deleteError) return { error: deleteError };
    if (profileIds.length > 0) {
      const { error: insertError } = await supabase.from('task_assignees').insert(profileIds.map((profileId) => ({ task_id: taskId, profile_id: profileId })));
      if (insertError) {
        await fetchDetails();
        return { error: insertError };
      }
    }
    await fetchDetails();
    return { error: null };
  };

  return {
    labels: details.labels,
    assignments: details.label_assignments,
    counts: details.subtask_counts,
    loading,
    getTaskLabels,
    createLabel,
    deleteLabel,
    assignLabel,
    removeLabel,
    getTaskAssignees,
    setTaskAssignees,
    refetch: fetchDetails,
  };
}