import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

type ReactionsMap = Record<string, Reaction[]>;

export function useMessageReactions(messageIds: string[]) {
  const [reactions, setReactions] = useState<ReactionsMap>({});
  const { profile } = useAuth();
  const messageIdsRef = useRef(messageIds);

  useEffect(() => {
    messageIdsRef.current = messageIds;
  }, [messageIds]);

  const fetchReactions = useCallback(async () => {
    const ids = messageIdsRef.current.filter(id => !id.startsWith('temp-'));
    if (ids.length === 0) { setReactions({}); return; }

    const { data, error } = await supabase
      .from('message_reactions' as any)
      .select('message_id, emoji, profile_id')
      .in('message_id', ids);

    if (error || !data) return;

    const grouped: ReactionsMap = {};
    for (const row of data as any[]) {
      if (!grouped[row.message_id]) grouped[row.message_id] = [];
      const existing = grouped[row.message_id].find((r: Reaction) => r.emoji === row.emoji);
      if (existing) {
        existing.count++;
        if (row.profile_id === profile?.id) existing.reactedByMe = true;
      } else {
        grouped[row.message_id].push({ emoji: row.emoji, count: 1, reactedByMe: row.profile_id === profile?.id });
      }
    }
    setReactions(grouped);
  }, [profile?.id]);

  useEffect(() => {
    fetchReactions();
  }, [messageIds.join(','), fetchReactions]);

  useEffect(() => {
    const channel = supabase
      .channel('message-reactions-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' as any }, () => {
        fetchReactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReactions]);

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;
    const msgReactions = reactions[messageId] || [];
    const existing = msgReactions.find(r => r.emoji === emoji);

    if (existing?.reactedByMe) {
      await supabase
        .from('message_reactions' as any)
        .delete()
        .eq('message_id', messageId)
        .eq('profile_id', profile.id)
        .eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions' as any).insert({ message_id: messageId, profile_id: profile.id, emoji });
    }
    fetchReactions();
  };

  return { reactions, toggleReaction };
}
