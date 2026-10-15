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

function isCompletedTask(t: { completed_at?: string | null; status?: string | null }) {
  return Boolean(t.completed_at) || t.status === 'done';
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

        // Fetch tasks assigned directly to members
        const { data: directTasks } = await supabase
          .from('tasks')
          .select('id, assigned_to, status, completed_at')
          .in('assigned_to', memberProfileIds);

        // Fetch tasks assigned via task_assignees (multi-assignee)
        const { data: assignees } = await supabase
          .from('task_assignees')
          .select('task_id, profile_id')
          .in('profile_id', memberProfileIds);

        const extraTaskIds = Array.from(new Set((assignees || []).map((a) => a.task_id)));
        const { data: extraTasks } = extraTaskIds.length
          ? await supabase
              .from('tasks')
              .select('id, status, completed_at')
              .in('id', extraTaskIds)
          : { data: [] as any[] };

        const taskById = new Map<string, { id: string; status: string; completed_at: string | null }>();
        for (const t of directTasks || []) taskById.set(t.id, t as any);
        for (const t of extraTasks || []) taskById.set(t.id, t as any);

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

        const tasksByMember = new Map<string, Set<string>>();

        // Direct assignments
        for (const t of directTasks || []) {
          if (!t.assigned_to) continue;
          if (!tasksByMember.has(t.assigned_to)) tasksByMember.set(t.assigned_to, new Set());
          tasksByMember.get(t.assigned_to)!.add(t.id);
        }

        // Multi assignees
        for (const a of assignees || []) {
          if (!a.profile_id) continue;
          if (!tasksByMember.has(a.profile_id)) tasksByMember.set(a.profile_id, new Set());
          tasksByMember.get(a.profile_id)!.add(a.task_id);
        }

        const result: MemberAnalytics[] = (profiles || []).map((p) => {
          const memberTaskIds = Array.from(tasksByMember.get(p.id) || []);
          const memberTasks = memberTaskIds.map((id) => taskById.get(id)).filter(Boolean) as any[];

          const memberMessages =
            (messages?.filter((m) => m.author_id === p.id)?.length || 0) +
            (dms?.filter((d) => d.sender_id === p.id)?.length || 0);

          const memberComments = comments?.filter((c) => c.author_id === p.id)?.length || 0;

          return {
            profileId: p.id,
            name: p.name,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            taskCount: memberTasks.length,
            completedTasks: memberTasks.filter((t) => isCompletedTask(t)).length,
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

