import { useEffect, useState, useCallback, useId } from 'react';
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

  // Each hook instance must own unique Realtime topics. Static topic names can
  // collide when this hook is mounted in more than one component, causing
  // Supabase to reject callbacks registered after a channel is subscribed.
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const fetchCounts = useCallback(async () => {
    if (!profile || !user) {
      setCounts({ unreadMessages: 0, unreadAnnouncements: 0, total: 0 });
      setLoading(false);
      return;
    }

    try {
      const { count: unreadMessages, error: msgError } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      if (msgError) console.error('Error fetching unread messages:', msgError);

      const now = new Date().toISOString();
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select('id')
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`expire_at.is.null,expire_at.gt.${now}`);

      if (annError) console.error('Error fetching announcements:', annError);

      const activeAnnouncements = announcements || [];
      const { data: readAnnouncements, error: readError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      if (readError) console.error('Error fetching read announcements:', readError);

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
    let cancelled = false;
    void fetchCounts();

    if (!profile || !user) return;

    const dmChannel = supabase
      .channel(`notification-dm-${instanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
      }, () => {
        if (!cancelled) void fetchCounts();
      })
      .subscribe();

    const annChannel = supabase
      .channel(`notification-announcements-${instanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcements',
      }, () => {
        if (!cancelled) void fetchCounts();
      })
      .subscribe();

    const readsChannel = supabase
      .channel(`notification-reads-${instanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'announcement_reads',
      }, () => {
        if (!cancelled) void fetchCounts();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(dmChannel);
      void supabase.removeChannel(annChannel);
      void supabase.removeChannel(readsChannel);
    };
  }, [profile, user, fetchCounts, instanceId]);

  const markAnnouncementAsRead = useCallback(async (announcementId: string) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from('announcement_reads')
      .select('id')
      .eq('announcement_id', announcementId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) return;

    const { error } = await supabase
      .from('announcement_reads')
      .insert({ announcement_id: announcementId, user_id: user.id });

    if (error) {
      console.error('Error marking announcement as read:', error);
    } else {
      setCounts(prev => ({
        ...prev,
        unreadAnnouncements: Math.max(0, prev.unreadAnnouncements - 1),
        total: Math.max(0, prev.total - 1),
      }));
      void fetchCounts();
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

    if (!announcements?.length) return;

    const { data: alreadyRead } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    const readIds = new Set((alreadyRead || []).map(r => r.announcement_id));
    const toMark = announcements.filter(a => !readIds.has(a.id));
    if (!toMark.length) return;

    const { error } = await supabase
      .from('announcement_reads')
      .insert(toMark.map(a => ({ announcement_id: a.id, user_id: user.id })));

    if (error) {
      console.error('Error marking all announcements as read:', error);
    } else {
      void fetchCounts();
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
      setCounts(prev => ({
        ...prev,
        unreadMessages: Math.max(0, prev.unreadMessages - 1),
        total: Math.max(0, prev.total - 1),
      }));
      void fetchCounts();
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
    resetCounts,
  };
}
