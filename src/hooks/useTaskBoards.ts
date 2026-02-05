import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskBoard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  background_image: string;
  created_at: string;
  updated_at: string;
}

export interface TaskBoardMember {
  id: string;
  board_id: string;
  user_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
  profile?: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface TaskBoardColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  position: number;
  created_at: string;
  auto_assign_to: string | null;
  auto_cover: string | null;
}

export function useTaskBoards() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('task_boards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBoards((data || []) as TaskBoard[]);
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBoards();
    const channel = supabase
      .channel('task-boards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_boards' }, () => fetchBoards())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBoards]);

  const createBoard = async (name: string, description?: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    try {
      const { data, error } = await supabase
        .from('task_boards')
        .insert({ name, description: description || null, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;

      // Create default columns
      const defaultColumns = [
        { board_id: data.id, title: 'A Fazer', color: '#6b7280', position: 0 },
        { board_id: data.id, title: 'Em Progresso', color: '#3b82f6', position: 1 },
        { board_id: data.id, title: 'Em Revisão', color: '#eab308', position: 2 },
        { board_id: data.id, title: 'Concluído', color: '#22c55e', position: 3 },
      ];
      await supabase.from('task_board_columns').insert(defaultColumns);

      // Add owner as board member
      const profileRes = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (profileRes.data) {
        await supabase.from('task_board_members').insert({
          board_id: data.id,
          user_id: user.id,
          profile_id: profileRes.data.id,
          role: 'owner',
        });
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error creating board:', error);
      return { data: null, error };
    }
  };

  const updateBoard = async (id: string, updates: Partial<TaskBoard>) => {
    try {
      const { error } = await supabase.from('task_boards').update(updates).eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteBoard = async (id: string) => {
    try {
      const { error } = await supabase.from('task_boards').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { boards, loading, createBoard, updateBoard, deleteBoard, refetch: fetchBoards };
}

export function useBoardMembers(boardId: string | null) {
  const [members, setMembers] = useState<TaskBoardMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_board_members')
        .select('*')
        .eq('board_id', boardId);
      if (error) throw error;
      
      // Fetch profiles separately
      const profileIds = (data || []).map(m => m.profile_id);
      const { data: profiles } = profileIds.length > 0
        ? await supabase.from('profiles').select('id, name, display_name, avatar_url').in('id', profileIds)
        : { data: [] };
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const membersWithProfiles = (data || []).map(m => ({
        ...m,
        profile: profileMap.get(m.profile_id) || undefined,
      }));
      
      setMembers(membersWithProfiles as TaskBoardMember[]);
    } catch (error) {
      console.error('Error fetching board members:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const addMember = async (userId: string, profileId: string) => {
    if (!boardId) return { error: new Error('No board') };
    try {
      const { error } = await supabase.from('task_board_members').insert({
        board_id: boardId, user_id: userId, profile_id: profileId, role: 'member',
      });
      if (error) throw error;
      await fetchMembers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('task_board_members').delete().eq('id', memberId);
      if (error) throw error;
      await fetchMembers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { members, loading, addMember, removeMember, refetch: fetchMembers };
}

export function useBoardColumns(boardId: string | null) {
  const [columns, setColumns] = useState<TaskBoardColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColumns = useCallback(async () => {
    if (!boardId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('task_board_columns')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true });
      if (error) throw error;
      setColumns((data || []) as TaskBoardColumn[]);
    } catch (error) {
      console.error('Error fetching columns:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchColumns();
    if (!boardId) return;
    const channel = supabase
      .channel(`board-columns-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_board_columns', filter: `board_id=eq.${boardId}` }, () => fetchColumns())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchColumns, boardId]);

  const addColumn = async (title: string, color: string = '#6366f1') => {
    if (!boardId) return { error: new Error('No board') };
    const position = columns.length;
    try {
      const { error } = await supabase.from('task_board_columns').insert({
        board_id: boardId, title, color, position,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateColumn = async (id: string, updates: Partial<TaskBoardColumn>) => {
    try {
      const { error } = await supabase.from('task_board_columns').update(updates).eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const deleteColumn = async (id: string) => {
    try {
      const { error } = await supabase.from('task_board_columns').delete().eq('id', id);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  return { columns, loading, addColumn, updateColumn, deleteColumn, refetch: fetchColumns };
}
