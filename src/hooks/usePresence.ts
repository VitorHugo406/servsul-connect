import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_heartbeat: string;
}

// Reduce write pressure on PostgreSQL: presence is advisory, not real-time telemetry.
const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const OFFLINE_THRESHOLD = 120000; // 120 seconds

export function usePresence() {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initialize or update presence on mount
    const initPresence = async () => {
      const { data, error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: true,
          last_heartbeat: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.error('Error initializing presence:', error);
      }
    };

    initPresence();

    // Set up heartbeat interval
    const heartbeatInterval = setInterval(async () => {
      const { error } = await supabase
        .from('user_presence')
        .update({
          is_online: true,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating heartbeat:', error);
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeatInterval);
      // Do not send an unauthenticated sendBeacon request during unload.
      // It bypasses the Supabase client's auth headers and produced repeated 500s.
      // The last_heartbeat timestamp is the source of truth for stale presence.
    };
  }, [user]);

  return null;
}

export function useUserPresence(userId?: string) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchPresence = async () => {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        const lastHeartbeat = new Date(data.last_heartbeat);
        const isRecentlyActive = Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD;
        setIsOnline(data.is_online && isRecentlyActive);
        setLastSeen(lastHeartbeat);
      }
    };

    fetchPresence();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const presence = payload.new as UserPresence;
          const lastHeartbeat = new Date(presence.last_heartbeat);
          const isRecentlyActive = Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD;
          setIsOnline(presence.is_online && isRecentlyActive);
          setLastSeen(lastHeartbeat);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { isOnline, lastSeen };
}

type PresenceEntry = { isOnline: boolean; lastHeartbeat: Date | null };
type PresenceMap = Record<string, PresenceEntry>;

// One shared subscription for every consumer of useAllUsersPresence. supabase.channel('all-presence') returns the SAME
// channel object for the same name, so a second component calling .on() after .subscribe() throws
// ("cannot add `postgres_changes` callbacks ... after `subscribe()`"), which crashed the chat when the chat list and an
// open direct conversation (including "Comunicados") used the hook at the same time.
const shared: { map: PresenceMap; listeners: Set<(m: PresenceMap) => void>; channel: ReturnType<typeof supabase.channel> | null; timer: ReturnType<typeof setInterval> | null } = { map: {}, listeners: new Set(), channel: null, timer: null };
const publish = (next: PresenceMap) => { shared.map = next; shared.listeners.forEach((l) => l(next)); };

async function fetchSharedPresence() {
  try {
    const { data } = await supabase.from('user_presence').select('user_id, is_online, last_heartbeat');
    if (!data) return;
    const map: PresenceMap = {};
    data.forEach((p) => {
      const lastHeartbeat = new Date(p.last_heartbeat);
      map[p.user_id] = { isOnline: p.is_online && Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD, lastHeartbeat };
    });
    publish(map);
  } catch { /* offline: keep the last known map */ }
}

function startSharedPresence() {
  void fetchSharedPresence();
  try {
    shared.channel = supabase
      .channel('all-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const next = { ...shared.map };
          const oldId = (payload.old as Partial<UserPresence> | null)?.user_id;
          if (oldId) delete next[oldId];
          publish(next);
          return;
        }
        const presence = payload.new as UserPresence;
        if (!presence?.user_id) return;
        const lastHeartbeat = new Date(presence.last_heartbeat);
        publish({ ...shared.map, [presence.user_id]: { isOnline: presence.is_online && Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD, lastHeartbeat } });
      })
      .subscribe();
  } catch { shared.channel = null; }
  // Recompute expiry locally instead of querying the database on every heartbeat.
  shared.timer = setInterval(() => {
    publish(Object.fromEntries(Object.entries(shared.map).map(([id, value]) => [id, { ...value, isOnline: Boolean(value.lastHeartbeat && Date.now() - value.lastHeartbeat.getTime() < OFFLINE_THRESHOLD && value.isOnline) }])));
  }, 15000);
}

function stopSharedPresence() {
  if (shared.timer) clearInterval(shared.timer);
  shared.timer = null;
  if (shared.channel) { try { void supabase.removeChannel(shared.channel); } catch { /* already closed */ } }
  shared.channel = null;
}

export function useAllUsersPresence() {
  const [presenceMap, setPresenceMap] = useState<PresenceMap>(shared.map);

  const fetchAllPresence = useCallback(() => fetchSharedPresence(), []);

  useEffect(() => {
    shared.listeners.add(setPresenceMap);
    if (shared.listeners.size === 1) startSharedPresence();
    else setPresenceMap(shared.map);
    return () => {
      shared.listeners.delete(setPresenceMap);
      if (shared.listeners.size === 0) stopSharedPresence();
    };
  }, []);

  const isUserOnline = useCallback((userId: string) => {
    return presenceMap[userId]?.isOnline ?? false;
  }, [presenceMap]);

  const getUserPresence = useCallback((userId: string) => {
    return presenceMap[userId] ?? { isOnline: false, lastHeartbeat: null };
  }, [presenceMap]);

  return { presenceMap, isUserOnline, getUserPresence, refetch: fetchAllPresence };
}
