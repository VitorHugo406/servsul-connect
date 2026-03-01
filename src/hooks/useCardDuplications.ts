import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CardDuplication {
  id: string;
  task_id: string;
  board_id: string;
  target_column_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  last_duplicated_at: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  weekdays: number[] | null;
  month_day: number | null;
}

export function useCardDuplications(boardId: string | null) {
  const { profile } = useAuth();
  const [duplications, setDuplications] = useState<CardDuplication[]>([]);

  const fetch = useCallback(async () => {
    if (!boardId) return;
    const { data } = await supabase
      .from('task_auto_duplications' as any)
      .select('*')
      .eq('board_id', boardId);
    setDuplications((data || []) as unknown as CardDuplication[]);
  }, [boardId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createDuplication = async (taskId: string, targetColumnId: string, frequency: string, weekdays?: number[], monthDay?: number) => {
    if (!profile || !boardId) return { error: new Error('Not ready') };
    const insertData: any = {
      task_id: taskId,
      board_id: boardId,
      target_column_id: targetColumnId,
      frequency,
      created_by: profile.id,
    };
    if (weekdays) insertData.weekdays = weekdays;
    if (monthDay) insertData.month_day = monthDay;
    const { error } = await supabase
      .from('task_auto_duplications' as any)
      .insert(insertData as any);
    if (!error) fetch();
    return { error };
  };

  const deleteDuplication = async (id: string) => {
    const { error } = await supabase
      .from('task_auto_duplications' as any)
      .delete()
      .eq('id', id);
    if (!error) fetch();
    return { error };
  };

  const getTaskDuplication = (taskId: string) => duplications.find(d => d.task_id === taskId);

  return { duplications, createDuplication, deleteDuplication, getTaskDuplication, refetch: fetch };
}
