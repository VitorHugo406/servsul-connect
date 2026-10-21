import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationCounts {
  unreadMessages: number;
  unreadAnnouncements: number;
  total: number;
}

interface NotificationContextValue {
  counts: NotificationCounts;
  loading: boolean;
  refetch: () => Promise<void>;
  markAnnouncementAsRead: (announcementId: string) => Promise<void>;
  markAllAnnouncementsAsRead: () => Promise<void>;
  markDirectMessagesAsRead: (partnerId: string) => Promise<void>;
  resetCounts: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

/**
 * Keep notification fetching and Realtime subscriptions in one place.
 * Multiple UI components consume the same context instead of opening duplicate
 * channels and repeating the same database queries.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const profileId = profile?.id;
  const userId = user?.id;
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    unreadAnnouncements: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      if (!profileId || !userId) {
        setCounts({ unreadMessages: 0, unreadAnnouncements: 0, total: 0 });
        setLoading(false);
        return;
      }

      try {
        const now = new Date().toISOString();
        const [messagesResult, announcementsResult, readsResult] = await Promise.all([
          supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', profileId)
            .eq('is_read', false),
          supabase
            .from('announcements')
            .select('id')
            .or(`start_at.is.null,start_at.lte.${now}`)
            .or(`expire_at.is.null,expire_at.gt.${now}`),
          supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', userId),
        ]);

        if (messagesResult.error) {
          console.error('Error fetching unread messages:', messagesResult.error);
        }
        if (announcementsResult.error) {
          console.error('Error fetching announcements:', announcementsResult.error);
        }
        if (readsResult.error) {
          console.error('Error fetching read announcements:', readsResult.error);
        }

        const activeAnnouncements = announcementsResult.data || [];
        const readIds = new Set((readsResult.data || []).map((row) => row.announcement_id));
        const unreadAnnouncements = activeAnnouncements.filter((row) => !readIds.has(row.id)).length;
        const unreadMessages = messagesResult.count || 0;

        setCounts({
          unreadMessages,
          unreadAnnouncements,
          total: unreadMessages + unreadAnnouncements,
        });
      } catch (error) {
        console.error('Error fetching notification counts:', error);
      } finally {
        setLoading(false);
      }
    })();

    inFlightRef.current = request;
    try {
      await request;
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null;
    }
  }, [profileId, userId]);

  useEffect(() => {
    void fetchCounts();
    if (!profileId || !userId) return;

    const dmChannel = supabase
      .channel(`notification-dm-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${profileId}`,
        },
        () => { void fetchCounts(); },
      )
      .subscribe();

    const announcementsChannel = supabase
      .channel(`notification-announcements-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => { void fetchCounts(); },
      )
      .subscribe();

    const readsChannel = supabase
      .channel(`notification-reads-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_reads',
          filter: `user_id=eq.${userId}`,
        },
        () => { void fetchCounts(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(dmChannel);
      void supabase.removeChannel(announcementsChannel);
      void supabase.removeChannel(readsChannel);
    };
  }, [profileId, userId, fetchCounts]);

  const markAnnouncementAsRead = useCallback(async (announcementId: string) => {
    if (!user) return;

    const { data: existing, error: lookupError } = await supabase
      .from('announcement_reads')
      .select('id')
      .eq('announcement_id', announcementId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      console.error('Error checking announcement read status:', lookupError);
      return;
    }
    if (existing) return;

    const { error } = await supabase
      .from('announcement_reads')
      .insert({ announcement_id: announcementId, user_id: user.id });

    if (error) {
      console.error('Error marking announcement as read:', error);
      return;
    }

    setCounts((previous) => ({
      ...previous,
      unreadAnnouncements: Math.max(0, previous.unreadAnnouncements - 1),
      total: Math.max(0, previous.total - 1),
    }));
    void fetchCounts();
  }, [user, fetchCounts]);

  const markAllAnnouncementsAsRead = useCallback(async () => {
    if (!user) return;

    const now = new Date().toISOString();
    const { data: announcements, error: announcementsError } = await supabase
      .from('announcements')
      .select('id')
      .or(`start_at.is.null,start_at.lte.${now}`)
      .or(`expire_at.is.null,expire_at.gt.${now}`);

    if (announcementsError || !announcements?.length) return;

    const { data: alreadyRead, error: readsError } = await supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);

    if (readsError) return;

    const readIds = new Set((alreadyRead || []).map((row) => row.announcement_id));
    const toMark = announcements
      .filter((row) => !readIds.has(row.id))
      .map((row) => ({ announcement_id: row.id, user_id: user.id }));

    if (toMark.length === 0) return;

    const { error } = await supabase.from('announcement_reads').insert(toMark);
    if (error) {
      console.error('Error marking all announcements as read:', error);
      return;
    }
    void fetchCounts();
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
      return;
    }

    setCounts((previous) => ({
      ...previous,
      unreadMessages: Math.max(0, previous.unreadMessages - 1),
      total: Math.max(0, previous.total - 1),
    }));
    void fetchCounts();
  }, [profile, fetchCounts]);

  const resetCounts = useCallback(() => {
    setCounts({ unreadMessages: 0, unreadAnnouncements: 0, total: 0 });
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    counts,
    loading,
    refetch: fetchCounts,
    markAnnouncementAsRead,
    markAllAnnouncementsAsRead,
    markDirectMessagesAsRead,
    resetCounts,
  }), [
    counts,
    loading,
    fetchCounts,
    markAnnouncementAsRead,
    markAllAnnouncementsAsRead,
    markDirectMessagesAsRead,
    resetCounts,
  ]);

  return createElement(NotificationContext.Provider, { value }, children);
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used inside NotificationsProvider');
  }
  return context;
}
