import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  sector_id: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  priority: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(id, name, display_name, avatar_url, sector_id)
      `)
      .lte('start_at', now)
      .or(`expire_at.is.null,expire_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
    } else {
      setAnnouncements(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    // Realtime subscription
    const channel = supabase
      .channel('announcements-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
        },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements]);

  const createAnnouncement = async (
    title: string,
    content: string,
    priority: 'normal' | 'important' | 'urgent' = 'normal',
    isPinned: boolean = false
  ) => {
    if (!profile) return { error: new Error('Not authenticated') };

    const { error } = await supabase.from('announcements').insert({
      title,
      content,
      author_id: profile.id,
      priority,
      is_pinned: isPinned,
    });

    return { error };
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    return { error };
  };

  return { 
    announcements, 
    loading, 
    createAnnouncement, 
    deleteAnnouncement,
    refetch: fetchAnnouncements 
  };
}
