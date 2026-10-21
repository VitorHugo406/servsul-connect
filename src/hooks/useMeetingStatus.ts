import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Auto-sets user status to "meeting" during scheduled meetings
 * and reverts to "available" when the meeting ends.
 *
 * This hook runs once per authenticated app session. Keep the fallback poll
 * modest and run independent lookups concurrently to avoid adding avoidable
 * load to the shared database connection pool.
 */
export function useMeetingStatus() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const profileId = profile?.id;
  const currentStatus = profile?.user_status || 'available';

  const checkMeetingStatus = useCallback(async () => {
    if (!userId || !profileId) return;

    const now = new Date().toISOString();

    const [ownEventsResult, participantEventsResult] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id')
        .eq('event_type', 'meeting')
        .eq('created_by', userId)
        .lte('start_date', now)
        .gte('end_date', now),
      supabase
        .from('meeting_participants')
        .select('event_id')
        .eq('profile_id', profileId)
        .eq('status', 'accepted'),
    ]);

    // Do not change a user's status based on incomplete results.
    if (ownEventsResult.error || participantEventsResult.error) {
      console.error(
        'Error checking meeting status:',
        ownEventsResult.error || participantEventsResult.error,
      );
      return;
    }

    const isInOwnMeeting = (ownEventsResult.data || []).length > 0;
    const participantEventIds = (participantEventsResult.data || []).map((row) => row.event_id);

    let isInInvitedMeeting = false;
    if (participantEventIds.length > 0) {
      const { data: meetingEvents, error } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('event_type', 'meeting')
        .in('id', participantEventIds)
        .lte('start_date', now)
        .gte('end_date', now);

      if (error) {
        console.error('Error checking invited meetings:', error);
        return;
      }
      isInInvitedMeeting = (meetingEvents || []).length > 0;
    }

    const isInMeeting = isInOwnMeeting || isInInvitedMeeting;

    if (isInMeeting && currentStatus !== 'meeting') {
      await supabase
        .from('profiles')
        .update({ user_status: 'meeting' })
        .eq('user_id', userId);
    } else if (!isInMeeting && currentStatus === 'meeting') {
      await supabase
        .from('profiles')
        .update({ user_status: 'available' })
        .eq('user_id', userId);
    }
  }, [userId, profileId, currentStatus]);

  useEffect(() => {
    if (!userId || !profileId) return;

    void checkMeetingStatus();
    // Meeting status does not need a 30-second database poll. Realtime covers
    // notifications elsewhere; this 60-second fallback keeps status current
    // without doubling recurring requests for every open browser tab.
    const interval = setInterval(() => { void checkMeetingStatus(); }, 60000);

    return () => clearInterval(interval);
  }, [userId, profileId, checkMeetingStatus]);
}
