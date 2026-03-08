import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  description: string;
  metadata: any;
  created_at: string;
}

export function useTaskActivities(taskId: string | null) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!taskId) { setActivities([]); setLoading(false); return; }
    try {
      const { data, error } = await (supabase as any)
        .from('task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setActivities((data || []) as TaskActivity[]);
    } catch (error) {
      console.error('Error fetching task activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return { activities, loading, refetch: fetchActivities };
}

export async function logTaskActivity(
  taskId: string,
  userId: string,
  userName: string,
  actionType: string,
  description: string,
  metadata: any = {}
) {
  try {
    await (supabase as any).from('task_activities').insert({
      task_id: taskId,
      user_id: userId,
      user_name: userName,
      action_type: actionType,
      description,
      metadata,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
