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
  start_at: string | null;
  expire_at: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [scheduledAnnouncements, setScheduledAnnouncements] = useState<Announcement[]>([]);
  const [expiredAnnouncements, setExpiredAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile, isAdmin, canAccess } = useAuth();

  const canManageAnnouncements = isAdmin || canAccess('can_post_announcements');

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    
    // Fetch active announcements (within valid date range)
    const { data: activeData, error: activeError } = await supabase
      .from('announcements')
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(id, name, display_name, avatar_url, sector_id)
      `)
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`expire_at.is.null,expire_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (activeError) {
      console.error('Error fetching announcements:', activeError);
    } else {
      // Filter to only show announcements that are truly active
      const filtered = (activeData || []).filter(a => {
        const startValid = !a.start_at || new Date(a.start_at) <= new Date(now);
        const expireValid = !a.expire_at || new Date(a.expire_at) > new Date(now);
        return startValid && expireValid;
      });
      setAnnouncements(filtered);
    }

    // If user can manage announcements, also fetch scheduled ones
    if (canManageAnnouncements) {
      // Fetch scheduled (future) announcements
      const { data: scheduledData } = await supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!announcements_author_id_fkey(id, name, display_name, avatar_url, sector_id)
        `)
        .gt('start_at', now)
        .order('start_at', { ascending: true });

      setScheduledAnnouncements(scheduledData || []);

      // Fetch expired announcements (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: expiredData } = await supabase
        .from('announcements')
        .select(`
          *,
          author:profiles!announcements_author_id_fkey(id, name, display_name, avatar_url, sector_id)
        `)
        .lt('expire_at', now)
        .gt('expire_at', thirtyDaysAgo.toISOString())
        .order('expire_at', { ascending: false });

      setExpiredAnnouncements(expiredData || []);
    }

    setLoading(false);
  }, [canManageAnnouncements]);

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
    isPinned: boolean = false,
    startAt?: string | null,
    expireAt?: string | null
  ) => {
    if (!profile) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase.from('announcements').insert({
      title,
      content,
      author_id: profile.id,
      priority,
      is_pinned: isPinned,
      start_at: startAt || new Date().toISOString(),
      expire_at: expireAt || null,
    }).select().single();

    // Send email notification in background
    if (!error && data) {
      const authorName = profile.display_name || profile.name || 'Administrador';
      supabase.functions.invoke('send-announcement-email', {
        body: { title, content, priority, authorName },
      }).then(res => {
        if (res.error) console.error('Error sending announcement email:', res.error);
        else console.log('Announcement email sent successfully');
      });
    }

    return { error };
  };

  const updateAnnouncement = async (
    id: string,
    updates: {
      title?: string;
      content?: string;
      priority?: string;
      is_pinned?: boolean;
      start_at?: string | null;
      expire_at?: string | null;
    }
  ) => {
    const { error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', id);
    return { error };
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    return { error };
  };

  return { 
    announcements, 
    scheduledAnnouncements,
    expiredAnnouncements,
    loading, 
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    refetch: fetchAnnouncements,
    canManageAnnouncements
  };
}
