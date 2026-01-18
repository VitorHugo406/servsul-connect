import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_heartbeat: string;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const OFFLINE_THRESHOLD = 60000; // 60 seconds

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

    // Set offline on beforeunload
    const handleBeforeUnload = () => {
      navigator.sendBeacon && navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`,
        JSON.stringify({ is_online: false })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Set offline on cleanup
      supabase
        .from('user_presence')
        .update({ is_online: false })
        .eq('user_id', user.id)
        .then();
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

export function useAllUsersPresence() {
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});

  const fetchAllPresence = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id, is_online, last_heartbeat');

    if (data) {
      const map: Record<string, boolean> = {};
      data.forEach((p) => {
        const lastHeartbeat = new Date(p.last_heartbeat);
        const isRecentlyActive = Date.now() - lastHeartbeat.getTime() < OFFLINE_THRESHOLD;
        map[p.user_id] = p.is_online && isRecentlyActive;
      });
      setPresenceMap(map);
    }
  }, []);

  useEffect(() => {
    fetchAllPresence();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('all-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          fetchAllPresence();
        }
      )
      .subscribe();

    // Refresh periodically to detect stale connections
    const refreshInterval = setInterval(fetchAllPresence, HEARTBEAT_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [fetchAllPresence]);

  const isUserOnline = useCallback((userId: string) => {
    return presenceMap[userId] ?? false;
  }, [presenceMap]);

  return { presenceMap, isUserOnline, refetch: fetchAllPresence };
}
