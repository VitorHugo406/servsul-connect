import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TeamMember {
  id: string;
  member_profile_id: string;
  profile: {
    id: string;
    user_id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
    email: string;
    sector_id: string | null;
    autonomy_level: string;
  };
}

export function useSupervisorTeam() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeam = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supervisor_team_members')
        .select('id, member_profile_id')
        .eq('supervisor_id', user.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const profileIds = data.map(d => d.member_profile_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, name, display_name, avatar_url, email, sector_id, autonomy_level')
          .in('id', profileIds);

        if (profilesError) throw profilesError;

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const teamMembers: TeamMember[] = data
          .map(d => ({
            id: d.id,
            member_profile_id: d.member_profile_id,
            profile: profileMap.get(d.member_profile_id)!,
          }))
          .filter(m => m.profile);

        setMembers(teamMembers);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const addMember = async (profileId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('supervisor_team_members')
        .insert({ supervisor_id: user.id, member_profile_id: profileId });
      if (error) throw error;
      await fetchTeam();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const removeMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('supervisor_team_members')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchTeam();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  return { members, loading, addMember, removeMember, refetch: fetchTeam };
}
