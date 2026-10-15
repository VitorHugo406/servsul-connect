import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WorkloadAlert {
  id: string;
  profile_id: string;
  board_id: string | null;
  alert_type: string;
  message: string;
  task_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useWorkloadAlerts(memberProfileIds: string[]) {
  const [alerts, setAlerts] = useState<WorkloadAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (memberProfileIds.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('workload_alerts')
        .select('*')
        .in('profile_id', memberProfileIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAlerts((data || []) as WorkloadAlert[]);
    } catch (error) {
      console.error('Error fetching workload alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [memberProfileIds.join(',')]);

  useEffect(() => {
    fetchAlerts();

    if (memberProfileIds.length === 0) return;

    const channel = supabase
      .channel('workload-alerts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workload_alerts' }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const markAsRead = async (alertId: string) => {
    try {
      await supabase.from('workload_alerts').update({ is_read: true }).eq('id', alertId);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      await supabase.from('workload_alerts').delete().eq('id', alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return { alerts, loading, unreadCount, markAsRead, dismissAlert, refetch: fetchAlerts };
}
