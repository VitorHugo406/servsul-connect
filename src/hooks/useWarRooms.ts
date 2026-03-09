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
  task_id?: string | null;
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

export interface EmergencyTaskInput {
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  subtask_groups?: Array<{ title: string; subtasks: string[] }>;
}

interface WarRoomCreateOptions {
  initialTimeline?: string[];
  emergencyTask?: EmergencyTaskInput;
}

export function useWarRooms() {
  const [warRooms, setWarRooms] = useState<WarRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile, isAdmin, canAccess } = useAuth();
  const { toast } = useToast();

  const canCreateWarRoom =
    isAdmin ||
    profile?.autonomy_level === 'supervisor' ||
    profile?.autonomy_level === 'gerente' ||
    profile?.autonomy_level === 'diretoria' ||
    canAccess('can_create_war_room');

  const fetchWarRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('war_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching war rooms:', error);
      setLoading(false);
      return;
    }
    setWarRooms((data || []) as WarRoom[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWarRooms();
  }, [fetchWarRooms]);

  const createEmergencyTask = async (task: EmergencyTaskInput, warRoomId?: string) => {
    if (!profile || !user) return { data: null, error: new Error('Usuário não autenticado') };

    const { data: lastTaskInColumn } = await supabase
      .from('tasks')
      .select('position')
      .eq('board_id', task.board_id)
      .eq('status', task.column_id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastTaskInColumn?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        board_id: task.board_id,
        status: task.column_id,
        title: task.title,
        description: task.description || null,
        priority: task.priority || 'high',
        due_date: task.due_date || null,
        created_by: profile.id,
        position: nextPosition,
        is_emergency: true,
      })
      .select('id, title, task_number, board_id, status')
      .single();

  if (error) {
    toast({ title: 'Erro ao criar card emergencial', description: error.message, variant: 'destructive' });
    return { data: null, error };
  }

  // Insert subtask groups and subtasks if provided
  if (task.subtask_groups && task.subtask_groups.length > 0) {
    for (let gi = 0; gi < task.subtask_groups.length; gi++) {
      const group = task.subtask_groups[gi];
      const { data: groupData } = await supabase
        .from('subtask_groups')
        .insert({ task_id: data.id, title: group.title, position: gi })
        .select('id')
        .single();
      if (groupData && group.subtasks.length > 0) {
        await supabase.from('task_subtasks').insert(
          group.subtasks.map((title, si) => ({
            task_id: data.id,
            group_id: groupData.id,
            title,
            position: si,
            is_completed: false,
          }))
        );
      }
    }
  }

  if (warRoomId) {
    await Promise.all([
      supabase.from('war_rooms').update({ task_id: data.id }).eq('id', warRoomId),
      supabase.from('war_room_timeline').insert({
        war_room_id: warRoomId,
        content: `Card emergencial #${data.task_number} criado: ${data.title}`,
        created_by: user.id,
        task_id: data.id,
      } as any),
    ]);
  }

    return { data, error: null };
  };

  const createWarRoom = async (
    title: string,
    description: string,
    memberProfileIds: string[],
    options?: WarRoomCreateOptions,
  ) => {
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

    const plannedActions = (options?.initialTimeline || []).map(item => item.trim()).filter(Boolean);

    const uniqueMemberProfileIds = Array.from(new Set([...memberProfileIds, profile.id]));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id')
      .in('id', uniqueMemberProfileIds);

    if (profiles?.length) {
      const memberInserts = profiles.map(p => ({
        war_room_id: room.id,
        profile_id: p.id,
        user_id: p.user_id,
        // Se eu criei a War Room, não devo receber alarme: já entra como acknowledged
        has_acknowledged: p.user_id === user.id,
        acknowledged_at: p.user_id === user.id ? new Date().toISOString() : null,
      }));

      const notifications = profiles
        .filter(p => p.user_id !== user.id)
        .map(p => ({
          user_id: p.user_id,
          type: 'war_room',
          title: '🚨 War Room Ativada',
          message: `Você foi convocado para a War Room: ${title}`,
          reference_id: room.id,
        }));

      await Promise.all([
        supabase.from('war_room_members').insert(memberInserts),
        notifications.length > 0
          ? supabase.from('user_notifications').insert(notifications)
          : Promise.resolve(),
      ]);
    }

    if (options?.emergencyTask) {
      await createEmergencyTask(options.emergencyTask, room.id);
    }

    const timelineInserts = [
      {
        war_room_id: room.id,
        content: `War Room "${title}" criada`,
        created_by: user.id,
      },
      ...plannedActions.map((action, index) => ({
        war_room_id: room.id,
        content: `Ação planejada ${index + 1}: ${action}`,
        created_by: user.id,
      })),
    ];

    await supabase.from('war_room_timeline').insert(timelineInserts);

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

  const deleteWarRoom = async (roomId: string) => {
    // Delete associated data first (messages, timeline, members)
    await Promise.all([
      supabase.from('war_room_messages').delete().eq('war_room_id', roomId),
      supabase.from('war_room_timeline').delete().eq('war_room_id', roomId),
      supabase.from('war_room_members').delete().eq('war_room_id', roomId),
    ]);

    const { error } = await supabase
      .from('war_rooms')
      .delete()
      .eq('id', roomId);

    if (error) {
      toast({ title: 'Erro ao excluir War Room', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'War Room excluída com sucesso' });
    fetchWarRooms();
    return true;
  };

  return { warRooms, loading, canCreateWarRoom, createWarRoom, closeWarRoom, deleteWarRoom, createEmergencyTask, fetchWarRooms };
}

export function useWarRoomDetail(roomId: string | null, roomCreatorId?: string) {
  const [members, setMembers] = useState<WarRoomMember[]>([]);
  const [timeline, setTimeline] = useState<WarRoomTimelineEntry[]>([]);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();

  const isRoomCreator = Boolean(user?.id && roomCreatorId && user.id === roomCreatorId);

  const fetchAll = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);

    const [membersRes, timelineRes, messagesRes] = await Promise.all([
      supabase
        .from('war_room_members')
        .select('*, profile:profiles(id, name, display_name, avatar_url)')
        .eq('war_room_id', roomId),
      supabase
        .from('war_room_timeline')
        .select('*')
        .eq('war_room_id', roomId)
        .order('created_at', { ascending: true }),
      supabase
        .from('war_room_messages')
        .select('*, sender:profiles!war_room_messages_sender_id_fkey(id, name, display_name, avatar_url)')
        .eq('war_room_id', roomId)
        .order('created_at', { ascending: true }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as unknown as WarRoomMember[]);

    if (timelineRes.data) {
      const creatorIds = [...new Set(timelineRes.data.map(t => t.created_by))];
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles')
          .select('user_id, name, display_name')
          .in('user_id', creatorIds);

        const creatorMap = new Map(creators?.map(c => [c.user_id, c.display_name || c.name]) || []);
        setTimeline(
          timelineRes.data.map(t => ({
            ...t,
            creator_name: creatorMap.get(t.created_by) || 'Desconhecido',
          })) as WarRoomTimelineEntry[],
        );
      } else {
        setTimeline(timelineRes.data as WarRoomTimelineEntry[]);
      }
    }

    if (messagesRes.data) setMessages(messagesRes.data as unknown as WarRoomMessage[]);

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`war-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'war_room_messages', filter: `war_room_id=eq.${roomId}` },
        async (payload) => {
          const msg = payload.new as any;
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, name, display_name, avatar_url')
            .eq('id', msg.sender_id)
            .single();
          setMessages(prev => {
            // Skip if already present (own optimistic message already has real ID)
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, { ...msg, sender } as unknown as WarRoomMessage];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'war_room_members', filter: `war_room_id=eq.${roomId}` },
        () => fetchAll(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'war_room_timeline', filter: `war_room_id=eq.${roomId}` },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    if (!isRoomCreator) {
      toast({
        title: 'Somente o criador da War Room pode adicionar itens na timeline',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('war_room_timeline').insert({
      war_room_id: roomId,
      content,
      created_by: user.id,
    });

    if (error) {
      toast({ title: 'Erro ao adicionar evento', description: error.message, variant: 'destructive' });
      return;
    }

    fetchAll();
  };

  const sendMessage = async (content: string) => {
    if (!roomId || !profile) {
      toast({ title: 'Erro ao enviar mensagem', description: 'Sessão não carregada', variant: 'destructive' });
      return false;
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: WarRoomMessage = {
      id: tempId,
      war_room_id: roomId,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      sender: {
        id: profile.id,
        name: profile.name,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data, error } = await supabase.from('war_room_messages').insert({
      war_room_id: roomId,
      sender_id: profile.id,
      content,
    }).select('id').single();

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({ 
        title: 'Erro ao enviar mensagem', 
        description: error.message,
        variant: 'destructive' 
      });
      return false;
    }

    // Replace temp ID with real ID
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
    return true;
  };

  return { members, timeline, messages, loading, acknowledge, addTimelineEntry, sendMessage, isRoomCreator, refetch: fetchAll };
}
