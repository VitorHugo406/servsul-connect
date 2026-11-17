import { useEffect, useState, useCallback, useId, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { withCompany } from '@/lib/companyScope';
import { mergeNoteHtml } from '@/lib/noteMerge';

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
  /** Filled by useNotes: what the signed-in user may do with this note. */
  my_permission?: 'owner' | 'edit' | 'read';
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
  // Cada instância do hook precisa de um tópico próprio no Realtime.
  // Isso evita registrar callbacks em um canal já inscrito quando a janela flutuante e a tela usam o hook.
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);

  // Only the first load shows the skeleton; realtime refreshes are silent (the list used to flash on every save).
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    if (!loadedOnce.current) setLoading(true);
    const [{ data, error }, { data: mine }] = await Promise.all([
      supabase.from('notes').select('*').order('is_pinned', { ascending: false }).order('updated_at', { ascending: false }),
      supabase.from('note_shares').select('note_id, permission').eq('shared_with_user_id', user.id),
    ]);
    if (error) {
      console.error(error);
      if (!loadedOnce.current) toast.error('Erro ao carregar anotações');
    } else {
      const perm = new Map((mine || []).map((r) => [r.note_id as string, r.permission as 'read' | 'edit']));
      setNotes(((data || []) as Note[]).map((n) => ({ ...n, my_permission: n.owner_id === user.id ? 'owner' : perm.get(n.id) || 'read' })));
    }
    loadedOnce.current = true;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notes-rt-${instanceId}`)
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
      .insert(withCompany({
        owner_id: user.id,
        title: 'Nova anotação',
        content: '',
        background_color: '#FFF9C4',
      }))
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
    const { my_permission: _p, ...clean } = patch;
    const { data, error } = await supabase.from('notes').update(clean).eq('id', id).select('id, updated_at');
    if (error) { toast.error('Erro ao salvar'); return false; }
    if (!data || !data.length) { toast.error('Você só pode visualizar esta anotação.'); void fetchNotes(); return false; }
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...clean, updated_at: (data[0] as { updated_at: string }).updated_at } : n)));
    return true;
  };

  /**
   * Saves the note text without overwriting what someone else saved meanwhile: compare-and-swap on the
   * current server text; if it changed since `base`, the three versions are merged (see noteMerge).
   * Returns the text that was stored (null when it could not be saved).
   */
  const saveContent = async (id: string, base: string, local: string): Promise<string | null> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: cur, error: e1 } = await supabase.from('notes').select('content').eq('id', id).maybeSingle();
      if (e1 || !cur) { toast.error('Erro ao salvar'); return null; }
      const server = (cur as { content: string }).content || '';
      const next = server === base ? local : mergeNoteHtml(base, local, server);
      if (next === server) { setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: next } : n))); return next; }
      const { data, error } = await supabase.from('notes').update({ content: next }).eq('id', id).eq('content', server).select('id, updated_at');
      if (error) { toast.error('Erro ao salvar'); return null; }
      if (data && data.length) {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: next, updated_at: (data[0] as { updated_at: string }).updated_at } : n)));
        return next;
      }
      // Nothing updated: either someone saved in between (try again) or this user can only read.
      const { data: again } = await supabase.from('notes').select('content').eq('id', id).maybeSingle();
      if (((again as { content: string } | null)?.content || '') === server) { toast.error('Você só pode visualizar esta anotação.'); return null; }
    }
    toast.error('Não foi possível salvar agora. Tente de novo.');
    return null;
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success('Anotação excluída');
    }
  };

  return { notes, loading, createNote, updateNote, saveContent, deleteNote, refetch: fetchNotes };
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
