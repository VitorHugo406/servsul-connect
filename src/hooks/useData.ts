import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

interface Sector {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  sector_id: string | null;
  autonomy_level: string;
  birth_date: string | null;
}

interface Message {
  id: string;
  content: string;
  author_id: string;
  sector_id: string;
  created_at: string;
  author?: Profile;
}

export function useMessages(sectorId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, isAdmin } = useAuth();

  const fetchMessages = useCallback(async () => {
    if (!sectorId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        author:profiles!messages_author_id_fkey(*)
      `)
      .eq('sector_id', sectorId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [sectorId]);

  useEffect(() => {
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${sectorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `sector_id=eq.${sectorId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sectorId, fetchMessages]);

  const sendMessage = async (content: string, onOptimisticUpdate?: (tempMessage: Message) => void) => {
    if (!profile || !sectorId) return { error: new Error('Not authenticated') };

    // Check if user can send to this sector (their sector, Geral, or admin)
    const canSend = isAdmin || 
                    sectorId === profile.sector_id || 
                    sectorId === GERAL_SECTOR_ID;
    
    if (!canSend) {
      return { error: new Error('You cannot send messages to this sector') };
    }

    // Create optimistic message for immediate UI update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content,
      author_id: profile.id,
      sector_id: sectorId,
      created_at: new Date().toISOString(),
      author: profile as Profile,
    };
    
    // Immediately add to local state for instant feedback
    setMessages(prev => [...prev, tempMessage]);
    onOptimisticUpdate?.(tempMessage);

    const { error, data } = await supabase.from('messages').insert({
      content,
      author_id: profile.id,
      sector_id: sectorId,
    }).select().single();

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
    // The realtime subscription will update with the real message

    return { error, data };
  };

  // Check if user can send messages to this sector (including additional sectors)
  const { allAccessibleSectorIds } = useAuth();
  const canSendMessages = isAdmin || allAccessibleSectorIds.includes(sectorId || '');
  return { messages, loading, sendMessage, refetch: fetchMessages, canSendMessages };
}

export function useSectors() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectors = async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching sectors:', error);
      } else {
        setSectors(data || []);
      }
      setLoading(false);
    };

    fetchSectors();
  }, []);

  return { sectors, loading };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching profiles:', error);
      } else {
        setProfiles(data || []);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, []);

  return { profiles, loading };
}

export function useBirthdays() {
  const { profiles, loading } = useProfiles();
  const { sectors } = useSectors();

  // Get today in local timezone
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const birthdayPeople = profiles
    .filter((p) => p.birth_date && (p as { is_active?: boolean }).is_active !== false)
    .map((p) => {
      // Parse birth date correctly - handle YYYY-MM-DD format
      const [year, month, day] = p.birth_date!.split('-').map(Number);
      const birthMonth = month;
      const birthDay = day;
      const isToday = birthMonth === currentMonth && birthDay === currentDay;
      const isThisMonth = birthMonth === currentMonth;
      const sector = sectors.find((s) => s.id === p.sector_id);

      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar_url || '',
        sector: sector?.name || 'Sem setor',
        birthDate: p.birth_date!,
        birthDay,
        birthMonth,
        isToday,
        isThisMonth,
      };
    })
    .filter((p) => p.isThisMonth)
    .sort((a, b) => a.birthDay - b.birthDay);

  return { birthdayPeople, loading, currentDay };
}
