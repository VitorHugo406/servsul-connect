import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TypingUser {
  profileId: string;
  name: string;
}

export function useTypingIndicator(channelName: string) {
  const { profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastSentRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!profile || !channelName) return;

    const channel = supabase.channel(`typing-${channelName}`, {
      config: { broadcast: { self: false } },
    })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.profileId === profile.id) return;
        
        setTypingUsers(prev => {
          const exists = prev.some(u => u.profileId === payload.profileId);
          if (!exists) return [...prev, { profileId: payload.profileId, name: payload.name }];
          return prev;
        });

        if (typingTimeoutRef.current[payload.profileId]) {
          clearTimeout(typingTimeoutRef.current[payload.profileId]);
        }
        
        typingTimeoutRef.current[payload.profileId] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.profileId !== payload.profileId));
          delete typingTimeoutRef.current[payload.profileId];
        }, 3000);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [profile, channelName]);

  const sendTyping = useCallback(() => {
    if (!profile || !channelName || !channelRef.current) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        profileId: profile.id,
        name: profile.display_name || profile.name,
      },
    });
  }, [profile, channelName]);

  return { typingUsers, sendTyping };
}
