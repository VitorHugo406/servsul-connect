import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Note {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  background_color: string;
  background_texture: string | null;
  background_image: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteShare {
  id: string;
  note_id: string;
  shared_with_user_id: string;
  permission: 'read' | 'edit';
  created_at: string;
}

export function useMyNotePermission(note: Note | null) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<'owner' | 'edit' | 'read' | null>(null);

  useEffect(() => {
    if (!note || !user) { setPermission(null); return; }
    if (note.owner_id === user.id) { setPermission('owner'); return; }
    (async () => {
      const { data } = await supabase
        .from('note_shares')
        .select('permission')
        .eq('note_id', note.id)
        .eq('shared_with_user_id', user.id)
        .maybeSingle();
      setPermission((data?.permission as 'read' | 'edit') || 'read');
    })();
  }, [note?.id, note?.owner_id, user?.id]);

  return permission;
}

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Erro ao carregar anotações');
    } else {
      setNotes((data || []) as Note[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('notes-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        fetchNotes();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_shares' }, () => {
        fetchNotes();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, fetchNotes]);

  const createNote = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('notes')
      .insert({
        owner_id: user.id,
        title: 'Nova anotação',
        content: '',
        background_color: '#FFF9C4',
      })
      .select()
      .single();
    if (error) {
      toast.error('Erro ao criar anotação');
      return null;
    }
    await fetchNotes();
    return data as Note;
  };

  const updateNote = async (id: string, patch: Partial<Note>) => {
    const { error } = await supabase.from('notes').update(patch).eq('id', id);
    if (error) toast.error('Erro ao salvar');
    else {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    }
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success('Anotação excluída');
    }
  };

  return { notes, loading, createNote, updateNote, deleteNote, refetch: fetchNotes };
}

export function useNoteShares(noteId: string | null) {
  const [shares, setShares] = useState<(NoteShare & { profile?: { name: string; email: string; avatar_url: string | null } })[]>([]);

  const fetchShares = useCallback(async () => {
    if (!noteId) {
      setShares([]);
      return;
    }
    const { data: rawShares, error } = await supabase
      .from('note_shares')
      .select('*')
      .eq('note_id', noteId);
    if (error || !rawShares) {
      setShares([]);
      return;
    }
    // Fetch profiles
    const userIds = rawShares.map((s) => s.shared_with_user_id);
    if (userIds.length === 0) {
      setShares([]);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, email, avatar_url')
      .in('user_id', userIds);
    setShares(
      rawShares.map((s) => ({
        ...(s as NoteShare),
        profile: profiles?.find((p) => p.user_id === s.shared_with_user_id) || undefined,
      })),
    );
  }, [noteId]);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const addShare = async (userId: string, permission: 'read' | 'edit') => {
    if (!noteId) return;
    const { error } = await supabase.from('note_shares').insert({
      note_id: noteId,
      shared_with_user_id: userId,
      permission,
    });
    if (error) {
      toast.error('Erro ao compartilhar');
    } else {
      toast.success('Anotação compartilhada');
      await fetchShares();
    }
  };

  const updateShare = async (shareId: string, permission: 'read' | 'edit') => {
    const { error } = await supabase.from('note_shares').update({ permission }).eq('id', shareId);
    if (error) toast.error('Erro ao atualizar permissão');
    else await fetchShares();
  };

  const removeShare = async (shareId: string) => {
    const { error } = await supabase.from('note_shares').delete().eq('id', shareId);
    if (error) toast.error('Erro ao remover');
    else {
      toast.success('Compartilhamento removido');
      await fetchShares();
    }
  };

  return { shares, addShare, updateShare, removeShare, refetch: fetchShares };
}
