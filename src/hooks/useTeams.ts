import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  supervisor_id: string;
  description: string | null;
  created_at: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  profile_id: string;
  created_at: string;
  profile?: {
    id: string;
    name: string;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    sector_id: string | null;
  };
}

export function useTeams() {
  const { user, profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch teams where user is supervisor
      const { data: myTeams } = await supabase
        .from('teams')
        .select('*')
        .eq('supervisor_id', user.id)
        .order('created_at');

      if (myTeams && myTeams.length > 0) {
        const teamsWithMembers: Team[] = [];
        for (const team of myTeams) {
          const { data: members } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', team.id);

          const profileIds = (members || []).map(m => m.profile_id);
          let profiles: any[] = [];
          if (profileIds.length > 0) {
            const { data } = await supabase
              .from('profiles')
              .select('id, name, display_name, email, avatar_url, sector_id')
              .in('id', profileIds);
            profiles = data || [];
          }

          teamsWithMembers.push({
            ...team,
            members: (members || []).map(m => ({
              ...m,
              profile: profiles.find(p => p.id === m.profile_id),
            })),
          });
        }
        setTeams(teamsWithMembers);
        if (!selectedTeamId && teamsWithMembers.length > 0) {
          setSelectedTeamId(teamsWithMembers[0].id);
        }
      } else {
        setTeams([]);
      }

      // Fetch teams where user is a member (for regular users)
      if (profile) {
        const { data: memberOf } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('profile_id', profile.id);

        if (memberOf && memberOf.length > 0) {
          const teamIds = memberOf.map(m => m.team_id);
          const { data: memberTeams } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds);

          const teamsWithMembers: Team[] = [];
          for (const team of (memberTeams || [])) {
            const { data: members } = await supabase
              .from('team_members')
              .select('*')
              .eq('team_id', team.id);

            const profileIds = (members || []).map(m => m.profile_id);
            let profiles: any[] = [];
            if (profileIds.length > 0) {
              const { data } = await supabase
                .from('profiles')
                .select('id, name, display_name, email, avatar_url, sector_id')
                .in('id', profileIds);
              profiles = data || [];
            }

            teamsWithMembers.push({
              ...team,
              members: (members || []).map(m => ({
                ...m,
                profile: profiles.find(p => p.id === m.profile_id),
              })),
            });
          }
          setUserTeams(teamsWithMembers);
        } else {
          setUserTeams([]);
        }
      }
    } catch (e) {
      console.error('Error fetching teams:', e);
    } finally {
      setLoading(false);
    }
  }, [user, profile, selectedTeamId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (name: string, description?: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('teams')
      .insert(withCompany({ name, supervisor_id: user.id, description: description || null }))
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar equipe.');
      return null;
    }
    toast.success('Equipe criada com sucesso!');
    await fetchTeams();
    return data;
  };

  const updateTeam = async (teamId: string, updates: { name?: string; description?: string }) => {
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId);

    if (error) {
      toast.error('Erro ao atualizar equipe.');
      return;
    }
    toast.success('Equipe atualizada.');
    await fetchTeams();
  };

  const deleteTeam = async (teamId: string) => {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) {
      toast.error('Erro ao excluir equipe.');
      return;
    }
    toast.success('Equipe excluída.');
    if (selectedTeamId === teamId) setSelectedTeamId(null);
    await fetchTeams();
  };

  const addMember = async (teamId: string, profileId: string) => {
    const { error } = await supabase
      .from('team_members')
      .insert({ team_id: teamId, profile_id: profileId });

    if (error) {
      if (error.code === '23505') toast.error('Membro já está na equipe.');
      else toast.error('Erro ao adicionar membro.');
      return;
    }
    toast.success('Membro adicionado.');
    await fetchTeams();
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      toast.error('Erro ao remover membro.');
      return;
    }
    toast.success('Membro removido.');
    await fetchTeams();
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || null;

  return {
    teams,
    userTeams,
    selectedTeam,
    selectedTeamId,
    setSelectedTeamId,
    loading,
    createTeam,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember,
    refreshTeams: fetchTeams,
  };
}
