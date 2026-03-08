import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface WarRoom {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  task_id: string | null;
  created_at: string;
  closed_at: string | null;
  updated_at: string;
}

export interface WarRoomMember {
  id: string;
  war_room_id: string;
  profile_id: string;
  user_id: string;
  has_acknowledged: boolean;
  acknowledged_at: string | null;
  joined_at: string;
  profile?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface WarRoomTimelineEntry {
  id: string;
  war_room_id: string;
  content: string;
  created_by: string;
  created_at: string;
  creator_name?: string;
}

export interface WarRoomMessage {
  id: string;
  war_room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useWarRooms() {
  const [warRooms, setWarRooms] = useState<WarRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile, isAdmin, canAccess } = useAuth();
  const { toast } = useToast();

  const canCreateWarRoom = isAdmin || 
    profile?.autonomy_level === 'supervisor' || 
    profile?.autonomy_level === 'gerente' || 
    profile?.autonomy_level === 'gestor' || 
    profile?.autonomy_level === 'diretoria' || 
    canAccess('can_create_war_room');

  const fetchWarRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('war_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching war rooms:', error);
      return;
    }
    setWarRooms((data || []) as WarRoom[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWarRooms();
  }, [fetchWarRooms]);

  const createWarRoom = async (title: string, description: string, memberProfileIds: string[]) => {
    if (!user || !profile) return null;

    const { data: room, error } = await supabase
      .from('war_rooms')
      .insert({ title, description, created_by: user.id })
      .select()
      .single();

    if (error || !room) {
      toast({ title: 'Erro ao criar War Room', description: error?.message, variant: 'destructive' });
      return null;
    }

    // Add members
    const members = memberProfileIds.map(pid => {
      // We need user_id for each profile
      return { war_room_id: room.id, profile_id: pid, user_id: '' };
    });

    // Fetch user_ids for selected profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id')
      .in('id', memberProfileIds);

    if (profiles) {
      const memberInserts = profiles.map(p => ({
        war_room_id: room.id,
        profile_id: p.id,
        user_id: p.user_id,
      }));

      await supabase.from('war_room_members').insert(memberInserts);

      // Create notifications for each member
      for (const p of profiles) {
        await supabase.from('user_notifications').insert({
          user_id: p.user_id,
          type: 'war_room',
          title: '🚨 War Room Ativada',
          message: `Você foi convocado para a War Room: ${title}`,
          reference_id: room.id,
        });
      }
    }

    // Add initial timeline entry
    await supabase.from('war_room_timeline').insert({
      war_room_id: room.id,
      content: `War Room "${title}" criada`,
      created_by: user.id,
    });

    toast({ title: 'War Room criada com sucesso!' });
    fetchWarRooms();
    return room as WarRoom;
  };

  const closeWarRoom = async (roomId: string) => {
    const { error } = await supabase
      .from('war_rooms')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', roomId);

    if (error) {
      toast({ title: 'Erro ao fechar War Room', variant: 'destructive' });
      return;
    }
    toast({ title: 'War Room encerrada' });
    fetchWarRooms();
  };

  return { warRooms, loading, canCreateWarRoom, createWarRoom, closeWarRoom, fetchWarRooms };
}

export function useWarRoomDetail(roomId: string | null) {
  const [members, setMembers] = useState<WarRoomMember[]>([]);
  const [timeline, setTimeline] = useState<WarRoomTimelineEntry[]>([]);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!roomId) return;

    const [membersRes, timelineRes, messagesRes] = await Promise.all([
      supabase.from('war_room_members').select('*, profile:profiles(id, name, display_name, avatar_url)').eq('war_room_id', roomId),
      supabase.from('war_room_timeline').select('*').eq('war_room_id', roomId).order('created_at', { ascending: true }),
      supabase.from('war_room_messages').select('*, sender:profiles!war_room_messages_sender_id_fkey(id, name, display_name, avatar_url)').eq('war_room_id', roomId).order('created_at', { ascending: true }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as unknown as WarRoomMember[]);
    if (timelineRes.data) {
      // Enrich timeline with creator names
      const creatorIds = [...new Set(timelineRes.data.map(t => t.created_by))];
      const { data: creators } = await supabase.from('profiles').select('user_id, name, display_name').in('user_id', creatorIds);
      const creatorMap = new Map(creators?.map(c => [c.user_id, c.display_name || c.name]) || []);
      setTimeline(timelineRes.data.map(t => ({ ...t, creator_name: creatorMap.get(t.created_by) || 'Desconhecido' })) as WarRoomTimelineEntry[]);
    }
    if (messagesRes.data) setMessages(messagesRes.data as unknown as WarRoomMessage[]);

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`war-room-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'war_room_messages', filter: `war_room_id=eq.${roomId}` }, async (payload) => {
        const msg = payload.new as any;
        const { data: sender } = await supabase.from('profiles').select('id, name, display_name, avatar_url').eq('id', msg.sender_id).single();
        setMessages(prev => [...prev, { ...msg, sender } as unknown as WarRoomMessage]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'war_room_members', filter: `war_room_id=eq.${roomId}` }, () => {
        fetchAll();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchAll]);

  const acknowledge = async () => {
    if (!roomId || !user) return;
    await supabase
      .from('war_room_members')
      .update({ has_acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('war_room_id', roomId)
      .eq('user_id', user.id);
    fetchAll();
  };

  const addTimelineEntry = async (content: string) => {
    if (!roomId || !user) return;
    const { error } = await supabase.from('war_room_timeline').insert({
      war_room_id: roomId,
      content,
      created_by: user.id,
    });
    if (error) {
      toast({ title: 'Erro ao adicionar evento', variant: 'destructive' });
      return;
    }
    fetchAll();
  };

  const sendMessage = async (content: string) => {
    if (!roomId || !profile) return;
    const { error } = await supabase.from('war_room_messages').insert({
      war_room_id: roomId,
      sender_id: profile.id,
      content,
    });
    if (error) {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    }
  };

  return { members, timeline, messages, loading, acknowledge, addTimelineEntry, sendMessage, refetch: fetchAll };
}
