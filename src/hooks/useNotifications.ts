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
        .lte('start_at', now)
        .or(`expire_at.is.null,expire_at.gt.${now}`);

      if (annError) {
        console.error('Error fetching announcements:', annError);
      }

      // Fetch read announcements for this user
      const { data: readAnnouncements, error: readError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (readError) {
        console.error('Error fetching read announcements:', readError);
      }

      const readIds = new Set((readAnnouncements || []).map(r => r.announcement_id));
      const unreadAnnouncements = (announcements || []).filter(a => !readIds.has(a.id)).length;

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

    const { error } = await supabase
      .from('announcement_reads')
      .upsert({
        announcement_id: announcementId,
        user_id: user.id,
      }, { onConflict: 'announcement_id,user_id' });

    if (error) {
      console.error('Error marking announcement as read:', error);
    } else {
      fetchCounts();
    }
  }, [user, fetchCounts]);

  return { counts, loading, refetch: fetchCounts, markAnnouncementAsRead };
}
