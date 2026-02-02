import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  sector_id: string | null;
  is_active: boolean;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

interface Conversation {
  partnerId: string;
  partner: Profile;
  lastMessage: DirectMessage;
  unreadCount: number;
}

export function useDirectMessages(partnerId?: string) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchMessages = useCallback(async () => {
    if (!profile || !partnerId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:profiles!direct_messages_sender_id_fkey(id, name, display_name, avatar_url, sector_id, is_active),
        receiver:profiles!direct_messages_receiver_id_fkey(id, name, display_name, avatar_url, sector_id, is_active)
      `)
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${profile.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching direct messages:', error);
    } else {
      setMessages(data || []);
      // Mark messages as read
      if (data && data.length > 0) {
        const unreadIds = data
          .filter(m => m.receiver_id === profile.id && !m.is_read)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          await supabase
            .from('direct_messages')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
    }
    setLoading(false);
  }, [profile, partnerId]);

  useEffect(() => {
    fetchMessages();

    if (!profile || !partnerId) return;

    // Realtime subscription
    const channel = supabase
      .channel(`dm-${profile.id}-${partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          // Only refetch if the message involves this conversation
          if (
            (msg.sender_id === profile.id && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === profile.id)
          ) {
            fetchMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, partnerId, fetchMessages]);

  const sendMessage = async (content: string) => {
    if (!profile || !partnerId) return { error: new Error('Not authenticated') };

    // Create optimistic message for immediate UI update
    const tempId = `temp-${Date.now()}`;
    const tempMessage: DirectMessage = {
      id: tempId,
      sender_id: profile.id,
      receiver_id: partnerId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    
    // Immediately add to local state for instant feedback
    setMessages(prev => [...prev, tempMessage]);

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      receiver_id: partnerId,
      content,
    });

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
    // The realtime subscription will update with the real message

    return { error };
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchConversations = useCallback(async () => {
    if (!profile) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get all messages involving the current user
    const { data: messages, error } = await supabase
      .from('direct_messages')
      .select(`
        *,
        sender:profiles!direct_messages_sender_id_fkey(id, name, display_name, avatar_url, sector_id, is_active),
        receiver:profiles!direct_messages_receiver_id_fkey(id, name, display_name, avatar_url, sector_id, is_active)
      `)
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
      return;
    }

    if (!messages || messages.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Group by conversation partner
    const conversationMap = new Map<string, Conversation>();
    
    for (const msg of messages) {
      const partnerId = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;
      const partner = msg.sender_id === profile.id ? msg.receiver : msg.sender;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partnerId,
          partner: partner as Profile,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      
      // Count unread messages
      if (msg.receiver_id === profile.id && !msg.is_read) {
        const conv = conversationMap.get(partnerId)!;
        conv.unreadCount += 1;
      }
    }

    setConversations(Array.from(conversationMap.values()));
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchConversations();

    if (!profile) return;

    // Realtime subscription for new messages
    const channel = supabase
      .channel(`conversations-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}

export function useActiveUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!profile) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, sector_id, is_active')
        .eq('is_active', true)
        .neq('id', profile.id)
        .order('name');

      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    };

    fetchUsers();
  }, [profile]);

  return { users, loading };
}