import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MemberScore {
  profileId: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  score: number;
  totalTasks: number;
  completedTasks: number;
  lateTasks: number;
  onTimeTasks: number;
}

export interface MonthlyScoreEntry {
  yearMonth: string;
  profileId: string;
  name: string;
  score: number;
}

function calculateScore(totalTasks: number, completedTasks: number, lateTasks: number): number {
  if (totalTasks === 0) return 0;
  const pointsPerTask = 1000 / totalTasks;
  const onTimeTasks = completedTasks - lateTasks;
  // On-time completed tasks get full points
  const onTimePoints = onTimeTasks * pointsPerTask;
  // Late completed tasks get 60% of points (40% penalty)
  const latePoints = lateTasks * pointsPerTask * 0.6;
  // Not completed tasks get 0 points
  return Math.round(onTimePoints + latePoints);
}

// Only count as late if delivered 1+ day after the deadline
function isTaskLate(task: { completed_at: string | null; due_date: string | null; completed_late: boolean | null }): boolean {
  if (!task.completed_at || !task.due_date) return false;
  const completedDate = new Date(task.completed_at);
  const dueDate = new Date(task.due_date);
  // Add 1 day to due date - only late if completed more than 1 day after
  const gracePeriod = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000);
  return completedDate > gracePeriod;
}

export function useBoardScores(boardId: string | null, memberProfileIds: string[]) {
  const [scores, setScores] = useState<MemberScore[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    if (!boardId || memberProfileIds.length === 0) {
      setScores([]);
      setMonthlyHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url')
        .in('id', memberProfileIds);

      // Fetch all board tasks (non-template, non-archived) for current month
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, assigned_to, status, completed_at, completed_late, due_date, created_at')
        .eq('board_id', boardId)
        .eq('is_template', false)
        .eq('is_archived', false);

      // Also get tasks via task_assignees for multi-assign
      const { data: assignees } = await supabase
        .from('task_assignees')
        .select('task_id, profile_id');

      const result: MemberScore[] = (profiles || []).map(p => {
        // Get tasks assigned to this member (primary or via assignees)
        const assigneeTaskIds = new Set(
          (assignees || []).filter(a => a.profile_id === p.id).map(a => a.task_id)
        );
        const memberTasks = (tasks || []).filter(t =>
          t.assigned_to === p.id || assigneeTaskIds.has(t.id)
        );

        const totalTasks = memberTasks.length;
        const completedTasks = memberTasks.filter(t => t.completed_at !== null).length;
        const lateTasks = memberTasks.filter(t => isTaskLate(t as any)).length;
        const onTimeTasks = completedTasks - lateTasks;
        const score = calculateScore(totalTasks, completedTasks, lateTasks);

        return {
          profileId: p.id,
          name: p.name,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          score,
          totalTasks,
          completedTasks,
          lateTasks,
          onTimeTasks,
        };
      });

      setScores(result.sort((a, b) => b.score - a.score));

      // Save/update current month scores
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      for (const r of result) {
        await supabase
          .from('monthly_scores')
          .upsert({
            profile_id: r.profileId,
            board_id: boardId,
            year_month: yearMonth,
            score: r.score,
            total_tasks: r.totalTasks,
            completed_tasks: r.completedTasks,
            late_tasks: r.lateTasks,
            on_time_tasks: r.onTimeTasks,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'profile_id,board_id,year_month',
          });
      }

      // Fetch last 6 months of history
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      const { data: historyData } = await supabase
        .from('monthly_scores')
        .select('year_month, profile_id, score')
        .eq('board_id', boardId)
        .in('profile_id', memberProfileIds)
        .in('year_month', months)
        .order('year_month');

      const history: MonthlyScoreEntry[] = (historyData || []).map((h: any) => {
        const prof = (profiles || []).find(p => p.id === h.profile_id);
        return {
          yearMonth: h.year_month,
          profileId: h.profile_id,
          name: prof?.display_name || prof?.name || 'Usuário',
          score: h.score,
        };
      });

      setMonthlyHistory(history);
    } catch (error) {
      console.error('Error fetching board scores:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId, memberProfileIds.join(',')]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { scores, monthlyHistory, loading, refetch: fetchScores };
}

// Hook for global scores across all boards (for People Management)
export function useGlobalScores(memberProfileIds: string[]) {
  const [scores, setScores] = useState<MemberScore[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberProfileIds.length === 0) {
      setScores([]);
      setMonthlyHistory([]);
      setLoading(false);
      return;
    }

    const fetchGlobalScores = async () => {
      setLoading(true);
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name, avatar_url')
          .in('id', memberProfileIds);

        // Fetch ALL tasks across all boards for these members
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, assigned_to, status, completed_at, completed_late, board_id')
          .in('assigned_to', memberProfileIds)
          .eq('is_template', false)
          .eq('is_archived', false);

        const { data: assignees } = await supabase
          .from('task_assignees')
          .select('task_id, profile_id')
          .in('profile_id', memberProfileIds);

        const result: MemberScore[] = (profiles || []).map(p => {
          const assigneeTaskIds = new Set(
            (assignees || []).filter(a => a.profile_id === p.id).map(a => a.task_id)
          );
          const memberTasks = (tasks || []).filter(t =>
            t.assigned_to === p.id || assigneeTaskIds.has(t.id)
          );

          const totalTasks = memberTasks.length;
          const completedTasks = memberTasks.filter(t => t.completed_at !== null).length;
          const lateTasks = memberTasks.filter(t => t.completed_late === true).length;
          const onTimeTasks = completedTasks - lateTasks;
          const score = calculateScore(totalTasks, completedTasks, lateTasks);

          return {
            profileId: p.id,
            name: p.name,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            score,
            totalTasks,
            completedTasks,
            lateTasks,
            onTimeTasks,
          };
        });

        setScores(result.sort((a, b) => b.score - a.score));

        // Fetch history from monthly_scores (aggregated across boards)
        const now = new Date();
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        const { data: historyData } = await supabase
          .from('monthly_scores')
          .select('year_month, profile_id, score, board_id')
          .in('profile_id', memberProfileIds)
          .in('year_month', months)
          .not('board_id', 'is', null)
          .order('year_month');

        // Aggregate scores per profile per month (average across boards)
        const grouped: Record<string, Record<string, number[]>> = {};
        for (const h of (historyData || []) as any[]) {
          const key = `${h.year_month}_${h.profile_id}`;
          if (!grouped[key]) grouped[key] = { scores: [] };
          (grouped[key] as any).scores = [...((grouped[key] as any).scores || []), h.score];
          (grouped[key] as any).yearMonth = h.year_month;
          (grouped[key] as any).profileId = h.profile_id;
        }

        const history: MonthlyScoreEntry[] = Object.values(grouped).map((g: any) => {
          const prof = (profiles || []).find(p => p.id === g.profileId);
          const avg = Math.round(g.scores.reduce((s: number, v: number) => s + v, 0) / g.scores.length);
          return {
            yearMonth: g.yearMonth,
            profileId: g.profileId,
            name: prof?.display_name || prof?.name || 'Usuário',
            score: avg,
          };
        });

        setMonthlyHistory(history);
      } catch (error) {
        console.error('Error fetching global scores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalScores();
  }, [memberProfileIds.join(',')]);

  return { scores, monthlyHistory, loading };
}
