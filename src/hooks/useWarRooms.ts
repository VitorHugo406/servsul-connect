import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { withCompany } from '@/lib/companyScope';

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
  target_at: string | null;
  emergency_board_id: string | null;
  emergency_column_id: string | null;
}

export interface WarRoomAction {
  id: string;
  war_room_id: string;
  title: string;
  assigned_to: string | null;
  duration_min: number;
  position: number;
  status: 'pending' | 'done';
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  subtask_id: string | null;
  created_at: string;
}

export interface NewWarRoomAction {
  title: string;
  assigned_to: string | null;
  duration_min: number;
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

interface WarRoomCreateOptions {
  targetAt?: string | null;
  actions?: NewWarRoomAction[];
  board_id?: string;
  column_id?: string;
}

export function useWarRooms() {
  const [warRooms, setWarRooms] = useState<WarRoom[]>([]);
  const [roomActions, setRoomActions] = useState<Record<string, WarRoomAction[]>>({});
  const [roomMembers, setRoomMembers] = useState<Record<string, WarRoomMember[]>>({});
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
    const rooms = (data || []) as unknown as WarRoom[];
    setWarRooms(rooms);
    const ids = rooms.map(r => r.id);
    if (ids.length) {
      const [acts, mems] = await Promise.all([
        supabase.from('war_room_actions' as any).select('*').in('war_room_id', ids).order('position', { ascending: true }),
        supabase.from('war_room_members').select('*, profile:profiles(id, name, display_name, avatar_url)').in('war_room_id', ids),
      ]);
      const ga: Record<string, WarRoomAction[]> = {};
      ((acts.data || []) as unknown as WarRoomAction[]).forEach(a => { (ga[a.war_room_id] ||= []).push(a); });
      const gm: Record<string, WarRoomMember[]> = {};
      ((mems.data || []) as unknown as WarRoomMember[]).forEach(m => { (gm[m.war_room_id] ||= []).push(m); });
      setRoomActions(ga); setRoomMembers(gm);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWarRooms();
  }, [fetchWarRooms]);

  /** Cria o card emergencial: só quadro + coluna; o resto vem da sala. */
  const createEmergencyCard = async (roomId: string, boardId: string, columnId: string) => {
    const { data, error } = await supabase.rpc('war_room_create_card' as any, { _room: roomId, _board: boardId, _column: columnId });
    if (error) {
      toast({ title: 'Erro ao criar o card', description: error.message, variant: 'destructive' });
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row as { o_task_id: string; o_task_number: number } | null;
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
      .insert(withCompany({ title, description, created_by: user.id, target_at: options?.targetAt || null }) as any)
      .select()
      .single();

    if (error || !room) {
      toast({ title: 'Erro ao criar War Room', description: error?.message, variant: 'destructive' });
      return null;
    }

    const plannedActions = (options?.actions || []).filter(a => a.title.trim());

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
          ? Promise.all(notifications.map((notification) => supabase.rpc('create_user_notification' as any, {
              _target_user_id: notification.user_id,
              _type: notification.type,
              _title: notification.title,
              _message: notification.message,
              _reference_id: room.id,
            })))
          : Promise.resolve(),
      ]);
    }

    if (plannedActions.length > 0) {
      const { error: actErr } = await supabase.from('war_room_actions' as any).insert(
        plannedActions.map((a, i) => ({
          war_room_id: room.id,
          title: a.title.trim(),
          assigned_to: a.assigned_to,
          duration_min: a.duration_min,
          position: i,
          created_by: user.id,
        })) as any,
      );
      if (actErr) toast({ title: 'Erro ao salvar as ações', description: actErr.message, variant: 'destructive' });
    }

    await supabase.from('war_room_timeline').insert({
      war_room_id: room.id,
      content: `War Room "${title}" criada`,
      created_by: user.id,
    });

    if (options?.board_id && options?.column_id) {
      await createEmergencyCard(room.id, options.board_id, options.column_id);
    }

    toast({ title: 'War Room criada com sucesso!' });
    fetchWarRooms();
    return room as unknown as WarRoom;
  };

  const closeWarRoom = async (roomId: string) => {
    const { error } = await supabase
      .from('war_rooms')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', roomId);

    if (error) {
      toast({ title: 'Erro ao fechar War Room', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'War Room encerrada', description: 'O card foi movido para Concluída.' });
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

  return { warRooms, roomActions, roomMembers, loading, canCreateWarRoom, createWarRoom, closeWarRoom, deleteWarRoom, createEmergencyCard, fetchWarRooms };
}

export function useWarRoomDetail(roomId: string | null, roomCreatorId?: string) {
  const [members, setMembers] = useState<WarRoomMember[]>([]);
  const [timeline, setTimeline] = useState<WarRoomTimelineEntry[]>([]);
  const [messages, setMessages] = useState<WarRoomMessage[]>([]);
  const [actions, setActions] = useState<WarRoomAction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();

  const isRoomCreator = Boolean(user?.id && roomCreatorId && user.id === roomCreatorId);
  const loadedRoom = useRef<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!roomId) return;

    // Só mostra o carregamento na primeira abertura da sala; depois as atualizações são silenciosas.
    if (loadedRoom.current !== roomId) setLoading(true);

    const [membersRes, timelineRes, messagesRes, actionsRes] = await Promise.all([
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
      supabase
        .from('war_room_actions' as any)
        .select('*')
        .eq('war_room_id', roomId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (actionsRes.data) setActions(actionsRes.data as unknown as WarRoomAction[]);
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

    loadedRoom.current = roomId;
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'war_room_actions', filter: `war_room_id=eq.${roomId}` },
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

  const fail = (title: string, message?: string) => toast({ title, description: message, variant: 'destructive' });

  const addAction = async (a: NewWarRoomAction) => {
    if (!roomId || !user) return false;
    const pos = actions.reduce((m, x) => Math.max(m, x.position), -1) + 1;
    const { error } = await supabase.from('war_room_actions' as any).insert({
      war_room_id: roomId, title: a.title.trim(), assigned_to: a.assigned_to, duration_min: a.duration_min, position: pos, created_by: user.id,
    } as any);
    if (error) { fail('Erro ao adicionar ação', error.message); return false; }
    await fetchAll();
    return true;
  };

  const updateAction = async (id: string, patch: Partial<Pick<WarRoomAction, 'title' | 'assigned_to' | 'duration_min'>>) => {
    const { error } = await supabase.from('war_room_actions' as any).update(patch as any).eq('id', id);
    if (error) { fail('Erro ao salvar a ação', error.message); return false; }
    await fetchAll();
    return true;
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from('war_room_actions' as any).delete().eq('id', id);
    if (error) { fail('Erro ao remover a ação', error.message); return false; }
    await fetchAll();
    return true;
  };

  const moveAction = async (id: string, dir: -1 | 1) => {
    const list = [...actions].sort((a, b) => a.position - b.position);
    const i = list.findIndex(a => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const results = await Promise.all(list.map((a, idx) => a.position === idx ? null
      : supabase.from('war_room_actions' as any).update({ position: idx } as any).eq('id', a.id)));
    const err = results.find(r => r && (r as any).error) as any;
    if (err) fail('Erro ao reordenar', err.error.message);
    await fetchAll();
  };

  const reorderActions = async (ids: string[]) => {
    const byId = new Map(actions.map(a => [a.id, a]));
    setActions(ids.map((id, i) => ({ ...(byId.get(id) as WarRoomAction), position: i })));
    const results = await Promise.all(ids.map((id, i) => byId.get(id)?.position === i ? null
      : supabase.from('war_room_actions' as any).update({ position: i } as any).eq('id', id)));
    const err = results.find(r => r && (r as any).error) as any;
    if (err) fail('Erro ao reordenar', err.error.message);
    await fetchAll();
  };

  const setActionDone = async (id: string, done: boolean) => {
    const before = actions;
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: done ? 'done' : 'pending' } as WarRoomAction : a));
    const { error } = await supabase.rpc('war_room_set_action' as any, { _action: id, _done: done });
    if (error) { setActions(before); fail('Não foi possível atualizar a ação', error.message); return false; }
    fetchAll();
    return true;
  };

  const clearHistory = async () => {
    if (!roomId) return;
    await Promise.all([
      supabase.from('war_room_messages').delete().eq('war_room_id', roomId),
      supabase.from('war_room_timeline').delete().eq('war_room_id', roomId),
    ]);
    await fetchAll();
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

  return { members, timeline, messages, actions, loading, acknowledge, addTimelineEntry, sendMessage, addAction, updateAction, deleteAction, moveAction, reorderActions, clearHistory, setActionDone, isRoomCreator, refetch: fetchAll };
}

/** Cards ligados a uma War Room ativa (controlados pela sala: só dá para concluir subtarefas). */
export function useWarRoomLockedTasks() {
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('war_room_locked_tasks' as any);
    if (error) return;
    setLocked(new Set(((data || []) as Array<{ task_id: string }>).map(r => r.task_id)));
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel(`wr-locks-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'war_rooms' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  return locked;
}
