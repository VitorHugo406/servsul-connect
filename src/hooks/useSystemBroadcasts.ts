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

export const BROADCASTS_CHANGED = 'ewvon:broadcasts-changed';
export const notifyBroadcastsChanged = () => window.dispatchEvent(new Event(BROADCASTS_CHANGED));

// Active right now: switched on and inside its start/end window.
export const isBroadcastLive = (b: SystemBroadcast, now = Date.now()) =>
  b.is_active && new Date(b.starts_at).getTime() <= now && (!b.ends_at || new Date(b.ends_at).getTime() > now);

export function useSystemBroadcasts(onlyActive = false, pollMs = 0) {
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
    if (!pollMs) return;
    // No realtime on this table: refresh periodically and when the window regains focus.
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void fetch(); }, pollMs);
    const onVis = () => { if (document.visibilityState === 'visible') void fetch(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [fetch, pollMs]);

  // Any screen that changes broadcasts announces it, so every list/orb refreshes at once.
  useEffect(() => {
    const on = () => { void fetch(); };
    window.addEventListener(BROADCASTS_CHANGED, on);
    return () => window.removeEventListener(BROADCASTS_CHANGED, on);
  }, [fetch]);

  const createBroadcast = async (payload: { title: string; content: string; severity: string; ends_at?: string | null }) => {
    const { error } = await (supabase as any).from('system_broadcasts').insert({
      title: payload.title,
      content: payload.content,
      severity: payload.severity,
      ends_at: payload.ends_at || null,
    });
    if (!error) notifyBroadcastsChanged();
    return { error };
  };

  const setActive = async (id: string, is_active: boolean) => {
    const { error } = await (supabase as any).from('system_broadcasts').update({ is_active }).eq('id', id);
    if (!error) notifyBroadcastsChanged();
    return { error };
  };

  const removeBroadcast = async (id: string) => {
    const { error } = await (supabase as any).from('system_broadcasts').delete().eq('id', id);
    if (!error) notifyBroadcastsChanged();
    return { error };
  };

  return { broadcasts, loading, refetch: fetch, createBroadcast, setActive, removeBroadcast };
}
