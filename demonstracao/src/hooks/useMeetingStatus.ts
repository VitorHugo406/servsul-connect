import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Auto-sets user status to "meeting" during scheduled meetings
 * and reverts to "available" when the meeting ends.
 */
export function useMeetingStatus() {
  const { user, profile } = useAuth();

  const checkMeetingStatus = useCallback(async () => {
    if (!user || !profile) return;

    const now = new Date();

    // Get events where user is creator
    const { data: ownEvents } = await supabase
      .from('calendar_events')
      .select('id, start_date, end_date, event_type, created_by')
      .eq('event_type', 'meeting')
      .eq('created_by', user.id)
      .lte('start_date', now.toISOString())
      .gte('end_date', now.toISOString());

    const isInOwnMeeting = (ownEvents || []).length > 0;

    // Check if user is an accepted participant in any ongoing meeting
    const { data: participantEvents } = await supabase
      .from('meeting_participants')
      .select('event_id, status')
      .eq('profile_id', profile.id)
      .eq('status', 'accepted');

    let isInInvitedMeeting = false;
    if (participantEvents && participantEvents.length > 0) {
      const eventIds = participantEvents.map(p => p.event_id);
      const { data: meetingEvents } = await supabase
        .from('calendar_events')
        .select('id, start_date, end_date, event_type')
        .eq('event_type', 'meeting')
        .in('id', eventIds)
        .lte('start_date', now.toISOString())
        .gte('end_date', now.toISOString());
      isInInvitedMeeting = (meetingEvents || []).length > 0;
    }

    const isInMeeting = isInOwnMeeting || isInInvitedMeeting;

    // Get current status
    const currentStatus = profile.user_status || 'available';

    if (isInMeeting && currentStatus !== 'meeting') {
      // Set to meeting
      await supabase
        .from('profiles')
        .update({ user_status: 'meeting' })
        .eq('user_id', user.id);
    } else if (!isInMeeting && currentStatus === 'meeting') {
      // Revert to available
      await supabase
        .from('profiles')
        .update({ user_status: 'available' })
        .eq('user_id', user.id);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) return;

    // Check immediately
    checkMeetingStatus();

    // Check every 30 seconds
    const interval = setInterval(checkMeetingStatus, 30000);

    return () => clearInterval(interval);
  }, [user, profile, checkMeetingStatus]);
}
