 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 export interface PrivateGroup {
   id: string;
   name: string;
   description: string | null;
   avatar_url: string | null;
   created_by: string;
   created_at: string;
   updated_at: string;
 }
 
 export interface GroupMember {
   id: string;
   group_id: string;
   user_id: string;
   profile_id: string;
   role: 'admin' | 'member';
   joined_at: string;
   profile?: {
     id: string;
     name: string;
     display_name: string | null;
     avatar_url: string | null;
     sector_id: string | null;
     user_status: string | null;
   };
 }
 
 export interface GroupMessage {
   id: string;
   group_id: string;
   sender_id: string;
   content: string;
   created_at: string;
   sender?: {
     id: string;
     name: string;
     display_name: string | null;
     avatar_url: string | null;
     sector_id: string | null;
   };
 }
 
 export function usePrivateGroups() {
   const { user, profile } = useAuth();
   const [groups, setGroups] = useState<PrivateGroup[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchGroups = useCallback(async () => {
    if (!user || !profile) return;
 
     try {
      // First create the group with the current user as the first member
       const { data, error } = await supabase
         .from('private_groups')
         .select('*')
         .order('updated_at', { ascending: false });
 
       if (error) throw error;
       setGroups(data || []);
     } catch (error) {
       console.error('Error fetching groups:', error);
     } finally {
       setLoading(false);
     }
  }, [user, profile]);
 
   useEffect(() => {
     fetchGroups();
   }, [fetchGroups]);
 
   const createGroup = async (name: string, description?: string) => {
     if (!user || !profile) return { error: new Error('Not authenticated') };
 
     try {
       // Create group
       const { data: group, error: groupError } = await supabase
         .from('private_groups')
         .insert({
           name,
           description,
           created_by: user.id,
         })
         .select()
         .single();
 
       if (groupError) throw groupError;
 
       // Add creator as admin
       const { error: memberError } = await supabase
         .from('private_group_members')
         .insert({
           group_id: group.id,
           user_id: user.id,
           profile_id: profile.id,
           role: 'admin',
         });
 
       if (memberError) throw memberError;
 
       await fetchGroups();
       return { data: group, error: null };
     } catch (error) {
       console.error('Error creating group:', error);
       return { data: null, error };
     }
   };

  const updateGroup = async (groupId: string, updates: { name?: string; description?: string; avatar_url?: string }) => {
    try {
      const { error } = await supabase
        .from('private_groups')
        .update(updates)
        .eq('id', groupId);

      if (error) throw error;
      await fetchGroups();
      return { error: null };
    } catch (error) {
      console.error('Error updating group:', error);
      return { error };
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      // Delete all members first
      await supabase.from('private_group_members').delete().eq('group_id', groupId);
      // Delete all messages
      await supabase.from('private_group_messages').delete().eq('group_id', groupId);
      // Delete the group
      const { error } = await supabase.from('private_groups').delete().eq('id', groupId);

      if (error) throw error;
      await fetchGroups();
      return { error: null };
    } catch (error) {
      console.error('Error deleting group:', error);
      return { error };
    }
  };
 
   return {
     groups,
     loading,
     createGroup,
    updateGroup,
    deleteGroup,
     refetch: fetchGroups,
   };
 }
 
 export function useGroupMembers(groupId: string | null) {
   const [members, setMembers] = useState<GroupMember[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchMembers = useCallback(async () => {
     if (!groupId) {
       setLoading(false);
       return;
     }
 
     try {
      // First get members
      const { data: membersData, error: membersError } = await supabase
         .from('private_group_members')
        .select('*')
         .eq('group_id', groupId);
 
      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Then fetch profile data for each member
      const profileIds = membersData.map(m => m.profile_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, sector_id, user_status')
        .in('id', profileIds);

      if (profilesError) throw profilesError;

      // Map profiles to members
      const membersWithProfiles = membersData.map(member => ({
        ...member,
        role: member.role as 'admin' | 'member',
        profile: profilesData?.find(p => p.id === member.profile_id),
      }));

      setMembers(membersWithProfiles as GroupMember[]);
     } catch (error) {
       console.error('Error fetching members:', error);
     } finally {
       setLoading(false);
     }
   }, [groupId]);
 
   useEffect(() => {
     fetchMembers();
   }, [fetchMembers]);
 
   const addMember = async (userId: string, profileId: string) => {
     if (!groupId) return { error: new Error('No group selected') };
 
     try {
       const { error } = await supabase
         .from('private_group_members')
         .insert({
           group_id: groupId,
           user_id: userId,
           profile_id: profileId,
           role: 'member',
         });
 
       if (error) throw error;
       await fetchMembers();
       return { error: null };
     } catch (error) {
       console.error('Error adding member:', error);
       return { error };
     }
   };
 
   const removeMember = async (memberId: string) => {
     try {
       const { error } = await supabase
         .from('private_group_members')
         .delete()
         .eq('id', memberId);
 
       if (error) throw error;
       await fetchMembers();
       return { error: null };
     } catch (error) {
       console.error('Error removing member:', error);
       return { error };
     }
   };
 
   const updateMemberRole = async (memberId: string, role: 'admin' | 'member') => {
     try {
       const { error } = await supabase
         .from('private_group_members')
         .update({ role })
         .eq('id', memberId);
 
       if (error) throw error;
       await fetchMembers();
       return { error: null };
     } catch (error) {
       console.error('Error updating member role:', error);
       return { error };
     }
   };
 
   return {
     members,
     loading,
     addMember,
     removeMember,
     updateMemberRole,
     refetch: fetchMembers,
   };
 }
 
 export function useGroupMessages(groupId: string | null) {
   const { profile } = useAuth();
   const [messages, setMessages] = useState<GroupMessage[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchMessages = useCallback(async () => {
     if (!groupId) {
       setLoading(false);
       return;
     }
 
      try {
        const { data, error } = await supabase
          .from('private_group_messages')
          .select(`
            *,
            sender:profiles(id, name, display_name, avatar_url, sector_id)
          `)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        // Preserve temp messages and merge
        setMessages(prev => {
          const tempMessages = prev.filter(m => m.id.startsWith('temp-'));
          const realMessages = (data || []) as GroupMessage[];
          const filteredTemp = tempMessages.filter(temp =>
            !realMessages.some(real =>
              real.content === temp.content &&
              real.sender_id === temp.sender_id &&
              Math.abs(new Date(real.created_at).getTime() - new Date(temp.created_at).getTime()) < 5000
            )
          );
          return [...realMessages, ...filteredTemp].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
     } catch (error) {
       console.error('Error fetching messages:', error);
     } finally {
       setLoading(false);
     }
   }, [groupId]);
 
   useEffect(() => {
     fetchMessages();
 
     if (!groupId) return;
 
     const channel = supabase
       .channel(`group-messages-${groupId}`)
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'private_group_messages',
           filter: `group_id=eq.${groupId}`,
         },
          async (payload) => {
            const newMsg = payload.new as GroupMessage;
            
            setMessages(prev => {
              // Check if we already have this message (from optimistic update)
              const existingIndex = prev.findIndex(m =>
                m.id === newMsg.id ||
                (m.id.startsWith('temp-') &&
                 m.content === newMsg.content &&
                 m.sender_id === newMsg.sender_id)
              );
              
              if (existingIndex >= 0) {
                // Replace temp message with real one, keep sender info
                const updated = [...prev];
                updated[existingIndex] = {
                  ...newMsg,
                  sender: prev[existingIndex].sender,
                };
                return updated;
              }
              
              // New message from another user - fetch sender info
              supabase
                .from('profiles')
                .select('id, name, display_name, avatar_url, sector_id')
                .eq('id', newMsg.sender_id)
                .single()
                .then(({ data: sender }) => {
                  if (sender) {
                    setMessages(p => p.map(m => m.id === newMsg.id ? { ...newMsg, sender } : m));
                  }
                });
              
              return [...prev, newMsg];
            });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [groupId, fetchMessages]);
 
   const sendMessage = async (content: string) => {
     if (!groupId || !profile) return { error: new Error('Not authenticated') };
 
     const tempId = `temp-${Date.now()}`;
     const tempMessage: GroupMessage = {
       id: tempId,
       group_id: groupId,
       sender_id: profile.id,
       content,
       created_at: new Date().toISOString(),
       sender: {
         id: profile.id,
         name: profile.name,
         display_name: profile.display_name,
         avatar_url: profile.avatar_url,
         sector_id: profile.sector_id,
       },
     };
 
     setMessages(prev => [...prev, tempMessage]);
 
     try {
       const { error } = await supabase
         .from('private_group_messages')
         .insert({
           group_id: groupId,
           sender_id: profile.id,
           content,
         });
 
       if (error) throw error;
 
       // Update group's updated_at
       await supabase
         .from('private_groups')
         .update({ updated_at: new Date().toISOString() })
         .eq('id', groupId);
 
       return { error: null };
     } catch (error) {
       console.error('Error sending message:', error);
       setMessages(prev => prev.filter(m => m.id !== tempId));
       return { error };
     }
   };
 
   return {
     messages,
     loading,
     sendMessage,
     refetch: fetchMessages,
   };
 }