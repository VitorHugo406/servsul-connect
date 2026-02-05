import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MemberAnalytics {
  profileId: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  taskCount: number;
  completedTasks: number;
  messageCount: number;
  announcementComments: number;
}

export function useTeamAnalytics(memberProfileIds: string[]) {
  const [analytics, setAnalytics] = useState<MemberAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberProfileIds.length === 0) {
      setAnalytics([]);
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // Fetch profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, display_name, avatar_url')
          .in('id', memberProfileIds);

        // Fetch tasks assigned to members
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, assigned_to, status')
          .in('assigned_to', memberProfileIds);

        // Fetch messages sent by members
        const { data: messages } = await supabase
          .from('messages')
          .select('id, author_id')
          .in('author_id', memberProfileIds);

        // Fetch DMs sent by members
        const { data: dms } = await supabase
          .from('direct_messages')
          .select('id, sender_id')
          .in('sender_id', memberProfileIds);

        // Fetch announcement comments by members
        const { data: comments } = await supabase
          .from('announcement_comments')
          .select('id, author_id')
          .in('author_id', memberProfileIds);

        const result: MemberAnalytics[] = (profiles || []).map(p => {
          const memberTasks = tasks?.filter(t => t.assigned_to === p.id) || [];
          const memberMessages = (messages?.filter(m => m.author_id === p.id)?.length || 0) +
            (dms?.filter(d => d.sender_id === p.id)?.length || 0);
          const memberComments = comments?.filter(c => c.author_id === p.id)?.length || 0;

          return {
            profileId: p.id,
            name: p.name,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            taskCount: memberTasks.length,
            completedTasks: memberTasks.filter(t => t.status === 'done').length,
            messageCount: memberMessages,
            announcementComments: memberComments,
          };
        });

        setAnalytics(result);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [memberProfileIds.join(',')]);

  return { analytics, loading };
}
