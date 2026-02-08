import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  sector_id: string | null;
  autonomy_level: string;
  birth_date: string | null;
  is_active: boolean;
  profile_type: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  user_status: string | null;
  work_period: string | null;
}

interface Sector {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface UserRole {
  role: 'admin' | 'gerente' | 'supervisor' | 'colaborador';
}

interface UserPermissions {
  can_post_announcements: boolean;
  can_delete_messages: boolean;
  can_access_management: boolean;
  can_access_password_change: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  sector: Sector | null;
  additionalSectors: Sector[];
  allAccessibleSectorIds: string[];
  roles: UserRole[];
  permissions: UserPermissions | null;
  isAdmin: boolean;
  geralSectorId: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  canAccess: (permission: keyof UserPermissions) => boolean;
  hasSectorAccess: (sectorId: string) => boolean;
}

const defaultPermissions: UserPermissions = {
  can_post_announcements: false,
  can_delete_messages: false,
  can_access_management: false,
  can_access_password_change: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [additionalSectors, setAdditionalSectors] = useState<Sector[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.some(r => r.role === 'admin');

  // Calculate all accessible sector IDs
  const allAccessibleSectorIds = [
    GERAL_SECTOR_ID, // Everyone has access to Geral
    ...(profile?.sector_id ? [profile.sector_id] : []), // Primary sector
    ...additionalSectors.map(s => s.id), // Additional sectors
  ];

  const fetchPermissions = async (userId: string) => {
    try {
      const { data: permData, error: permError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (permError) {
        console.error('Error fetching permissions:', permError);
        return;
      }

      if (permData) {
        setPermissions({
          can_post_announcements: permData.can_post_announcements,
          can_delete_messages: permData.can_delete_messages,
          can_access_management: permData.can_access_management,
          can_access_password_change: permData.can_access_password_change,
        });
      } else {
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('Error in fetchPermissions:', error);
      setPermissions(defaultPermissions);
    }
  };

  const fetchAdditionalSectors = async (userId: string) => {
    try {
      // Fetch additional sector IDs
      const { data: additionalData, error: additionalError } = await supabase
        .from('user_additional_sectors')
        .select('sector_id')
        .eq('user_id', userId);

      if (additionalError) {
        console.error('Error fetching additional sectors:', additionalError);
        return;
      }

      if (additionalData && additionalData.length > 0) {
        const sectorIds = additionalData.map(d => d.sector_id);
        
        // Fetch full sector details
        const { data: sectorsData, error: sectorsError } = await supabase
          .from('sectors')
          .select('*')
          .in('id', sectorIds);

        if (sectorsError) {
          console.error('Error fetching sector details:', sectorsError);
          return;
        }

        if (sectorsData) {
          setAdditionalSectors(sectorsData as Sector[]);
        }
      } else {
        setAdditionalSectors([]);
      }
    } catch (error) {
      console.error('Error in fetchAdditionalSectors:', error);
      setAdditionalSectors([]);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setProfile(profileData as Profile);

        if (profileData.sector_id) {
          const { data: sectorData } = await supabase
            .from('sectors')
            .select('*')
            .eq('id', profileData.sector_id)
            .maybeSingle();

          if (sectorData) {
            setSector(sectorData as Sector);
          }
        }
      }

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      } else if (rolesData) {
        setRoles(rolesData as UserRole[]);
      }

      // Fetch additional sectors
      await fetchAdditionalSectors(userId);

      // Fetch permissions
      await fetchPermissions(userId);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const refreshPermissions = async () => {
    if (user) {
      await fetchPermissions(user.id);
    }
  };

  const canAccess = (permission: keyof UserPermissions): boolean => {
    if (isAdmin) return true;
    if (!permissions) return false;
    return permissions[permission];
  };

  const hasSectorAccess = (sectorId: string): boolean => {
    if (isAdmin) return true;
    return allAccessibleSectorIds.includes(sectorId);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSector(null);
          setAdditionalSectors([]);
          setRoles([]);
          setPermissions(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error as Error | null };
    }

    // Check if user is active
    if (data.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error checking user status:', profileError);
        await supabase.auth.signOut();
        return { error: new Error('Erro ao verificar status do usuário') };
      }

      if (profileData && !profileData.is_active) {
        // User is inactive, sign them out
        await supabase.auth.signOut();
        return { error: new Error('Usuário inativo. Entre em contato com o administrador.') };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    setProfile(null);
    setSector(null);
    setAdditionalSectors([]);
    setRoles([]);
    setPermissions(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        sector,
        additionalSectors,
        allAccessibleSectorIds,
        roles,
        permissions,
        isAdmin,
        geralSectorId: GERAL_SECTOR_ID,
        loading,
        signIn,
        signOut,
        refreshProfile,
        refreshPermissions,
        canAccess,
        hasSectorAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}