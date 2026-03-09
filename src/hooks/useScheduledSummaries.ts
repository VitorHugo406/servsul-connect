import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ScheduledSummary {
  id: string;
  target_type: 'group' | 'sector';
  target_id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  metrics: string[];
  format: 'text' | 'visual';
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export const SUMMARY_METRICS = [
  { id: 'completed_on_time', label: 'Tarefas concluídas no prazo', icon: '✅' },
  { id: 'completed_late', label: 'Tarefas concluídas com atraso', icon: '⚠️' },
  { id: 'pending_tasks', label: 'Tarefas pendentes/abertas', icon: '📋' },
  { id: 'overdue_tasks', label: 'Tarefas atrasadas', icon: '🔴' },
  { id: 'total_messages', label: 'Total de mensagens enviadas', icon: '💬' },
];

export const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function useScheduledSummaries(targetType: 'group' | 'sector', targetId: string | null) {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<ScheduledSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummaries = useCallback(async () => {
    if (!targetId) { setLoading(false); return; }
    try {
      const { data, error } = await (supabase
        .from('scheduled_summaries')
        .select('*')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: false }) as any);
      if (error) throw error;
      setSummaries((data || []) as ScheduledSummary[]);
    } catch (e) {
      console.error('Error fetching scheduled summaries:', e);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const createSummary = async (config: {
    frequency: string;
    send_time: string;
    weekday?: number;
    month_day?: number;
    metrics: string[];
    format: string;
  }) => {
    if (!targetId || !user) return { error: new Error('Not ready') };
    try {
      const { data, error } = await (supabase
        .from('scheduled_summaries')
        .insert({
          target_type: targetType,
          target_id: targetId,
          frequency: config.frequency,
          send_time: config.send_time,
          weekday: config.weekday ?? null,
          month_day: config.month_day ?? null,
          metrics: config.metrics,
          format: config.format,
          created_by: user.id,
        } as any)
        .select()
        .single() as any);
      if (error) throw error;
      await fetchSummaries();
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const deleteSummary = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('scheduled_summaries')
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
      await fetchSummaries();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const toggleSummary = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase
        .from('scheduled_summaries')
        .update({ is_active: isActive })
        .eq('id', id) as any);
      if (error) throw error;
      await fetchSummaries();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { summaries, loading, createSummary, deleteSummary, toggleSummary, refetch: fetchSummaries };
}
