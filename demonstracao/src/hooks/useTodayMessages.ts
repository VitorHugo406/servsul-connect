import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const GENERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Counts only the messages the user RECEIVED today (local day), across the
 * channels the user belongs to: sector chats, direct messages and private
 * groups. Messages sent by the user are not counted.
 */
export function useTodayMessages() {
  const { profile } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile) { setCount(0); return; }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    try {
      const sectorIds = [profile.sector_id, GENERAL_SECTOR_ID].filter(Boolean) as string[];

      const [sectorRes, dmRes, groupRes] = await Promise.all([
        sectorIds.length
          ? supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .in('sector_id', [...new Set(sectorIds)])
              .neq('author_id', profile.id)
              .gte('created_at', startIso)
          : Promise.resolve({ count: 0 } as { count: number | null }),
        supabase
          .from('direct_messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', profile.id)
          .gte('created_at', startIso),
        supabase.from('private_group_members').select('group_id').eq('profile_id', profile.id),
      ]);

      let groupCount = 0;
      const groupIds = ((groupRes as any)?.data ?? []).map((row: any) => row.group_id);
      if (groupIds.length) {
        const { count: gc } = await supabase
          .from('private_group_messages')
          .select('id', { count: 'exact', head: true })
          .in('group_id', groupIds)
          .neq('sender_id', profile.id)
          .gte('created_at', startIso);
        groupCount = gc || 0;
      }

      setCount((sectorRes.count || 0) + (dmRes.count || 0) + groupCount);
    } catch (error) {
      console.error('Erro ao contar mensagens de hoje:', error);
    }
  }, [profile]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  return { todayMessages: count, refresh: load };
}
