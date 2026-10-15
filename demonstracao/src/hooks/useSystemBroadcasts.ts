import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemBroadcast {
  id: string;
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

export function useSystemBroadcasts(onlyActive = false) {
  const [broadcasts, setBroadcasts] = useState<SystemBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from('system_broadcasts').select('*').order('created_at', { ascending: false });
    if (onlyActive) query = query.eq('is_active', true);
    const { data } = await query;
    setBroadcasts(((data || []) as SystemBroadcast[]));
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createBroadcast = async (payload: { title: string; content: string; severity: string; ends_at?: string | null }) => {
    const { error } = await (supabase as any).from('system_broadcasts').insert({
      title: payload.title,
      content: payload.content,
      severity: payload.severity,
      ends_at: payload.ends_at || null,
    });
    if (!error) await fetch();
    return { error };
  };

  const setActive = async (id: string, is_active: boolean) => {
    const { error } = await (supabase as any).from('system_broadcasts').update({ is_active }).eq('id', id);
    if (!error) await fetch();
    return { error };
  };

  const removeBroadcast = async (id: string) => {
    const { error } = await (supabase as any).from('system_broadcasts').delete().eq('id', id);
    if (!error) await fetch();
    return { error };
  };

  return { broadcasts, loading, refetch: fetch, createBroadcast, setActive, removeBroadcast };
}
