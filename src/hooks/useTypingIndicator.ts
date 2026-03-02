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

  useEffect(() => {
    if (!profile || !channelName) return;

    const channel = supabase.channel(`typing-${channelName}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.profileId === profile.id) return;
        
        setTypingUsers(prev => {
          const exists = prev.some(u => u.profileId === payload.profileId);
          if (!exists) return [...prev, { profileId: payload.profileId, name: payload.name }];
          return prev;
        });

        // Clear previous timeout for this user
        if (typingTimeoutRef.current[payload.profileId]) {
          clearTimeout(typingTimeoutRef.current[payload.profileId]);
        }
        
        // Remove after 3 seconds of no typing
        typingTimeoutRef.current[payload.profileId] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.profileId !== payload.profileId));
          delete typingTimeoutRef.current[payload.profileId];
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [profile, channelName]);

  const sendTyping = useCallback(() => {
    if (!profile || !channelName) return;
    const now = Date.now();
    if (now - lastSentRef.current < 2000) return; // Throttle to every 2s
    lastSentRef.current = now;

    supabase.channel(`typing-${channelName}`).send({
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
