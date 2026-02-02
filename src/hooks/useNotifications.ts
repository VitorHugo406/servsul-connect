import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationCounts {
  unreadMessages: number;
  unreadAnnouncements: number;
  total: number;
}

export function useNotifications() {
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    unreadAnnouncements: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const { profile, user } = useAuth();

  const fetchCounts = useCallback(async () => {
    if (!profile || !user) {
      setCounts({ unreadMessages: 0, unreadAnnouncements: 0, total: 0 });
      setLoading(false);
      return;
    }

    try {
      // Fetch unread direct messages
      const { count: unreadMessages, error: msgError } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      if (msgError) {
        console.error('Error fetching unread messages:', msgError);
      }

      // Fetch active announcements that the user hasn't read
      const now = new Date().toISOString();
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select('id')
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`expire_at.is.null,expire_at.gt.${now}`);

      if (annError) {
        console.error('Error fetching announcements:', annError);
      }

      // Filter to active only
      const activeAnnouncements = (announcements || []).filter(a => {
        // We need to re-check since supabase OR is tricky
        return true; // The query already filters
      });

      // Fetch read announcements for this user
      const { data: readAnnouncements, error: readError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (readError) {
        console.error('Error fetching read announcements:', readError);
      }

      const readIds = new Set((readAnnouncements || []).map(r => r.announcement_id));
      const unreadAnnouncements = activeAnnouncements.filter(a => !readIds.has(a.id)).length;

      const total = (unreadMessages || 0) + unreadAnnouncements;

      setCounts({
        unreadMessages: unreadMessages || 0,
        unreadAnnouncements,
        total,
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  useEffect(() => {
    fetchCounts();

    if (!profile || !user) return;

    // Subscribe to direct messages
    const dmChannel = supabase
      .channel('notification-dm')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to announcements
    const annChannel = supabase
      .channel('notification-announcements')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to announcement reads
    const readsChannel = supabase
      .channel('notification-reads')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_reads',
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dmChannel);
      supabase.removeChannel(annChannel);
      supabase.removeChannel(readsChannel);
    };
  }, [profile, user, fetchCounts]);

  const markAnnouncementAsRead = useCallback(async (announcementId: string) => {
    if (!user) return;

    // First check if already read
    const { data: existing } = await supabase
      .from('announcement_reads')
      .select('id')
      .eq('announcement_id', announcementId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) return; // Already read

    const { error } = await supabase
      .from('announcement_reads')
      .insert({
        announcement_id: announcementId,
        user_id: user.id,
      });

    if (error) {
      console.error('Error marking announcement as read:', error);
    } else {
      // Immediately update the counts locally for instant feedback
      setCounts(prev => ({
        ...prev,
        unreadAnnouncements: Math.max(0, prev.unreadAnnouncements - 1),
        total: Math.max(0, prev.total - 1),
      }));
      // Then refetch to get accurate counts
      fetchCounts();
    }
  }, [user, fetchCounts]);

  const markAllAnnouncementsAsRead = useCallback(async () => {
    if (!user) return;

    const now = new Date().toISOString();
    const { data: announcements } = await supabase
      .from('announcements')
      .select('id')
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`expire_at.is.null,expire_at.gt.${now}`);

    if (!announcements || announcements.length === 0) return;

    // Get already read
    const { data: alreadyRead } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    const readIds = new Set((alreadyRead || []).map(r => r.announcement_id));
    const toMark = announcements.filter(a => !readIds.has(a.id));

    if (toMark.length === 0) return;

    // Insert all unread
    const { error } = await supabase
      .from('announcement_reads')
      .insert(toMark.map(a => ({
        announcement_id: a.id,
        user_id: user.id,
      })));

    if (error) {
      console.error('Error marking all announcements as read:', error);
    } else {
      fetchCounts();
    }
  }, [user, fetchCounts]);

  const markDirectMessagesAsRead = useCallback(async (partnerId: string) => {
    if (!profile) return;

    const { error } = await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('receiver_id', profile.id)
      .eq('sender_id', partnerId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
    } else {
      // Immediately update the counts locally for instant feedback
      setCounts(prev => ({
        ...prev,
        unreadMessages: Math.max(0, prev.unreadMessages - 1),
        total: Math.max(0, prev.total - 1),
      }));
      // Then refetch to get accurate counts
      fetchCounts();
    }
  }, [profile, fetchCounts]);

  const resetCounts = useCallback(() => {
    setCounts({ unreadMessages: 0, unreadAnnouncements: 0, total: 0 });
  }, []);

  return { 
    counts, 
    loading, 
    refetch: fetchCounts, 
    markAnnouncementAsRead, 
    markAllAnnouncementsAsRead,
    markDirectMessagesAsRead,
    resetCounts
  };
}
