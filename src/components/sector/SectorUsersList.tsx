import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAllUsersPresence } from '@/hooks/usePresence';
import { UserStatusBadge, STATUS_OPTIONS } from '@/components/user/UserStatusSelector';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  sector_id: string | null;
  user_status: string | null;
}

interface SectorUsersListProps {
  sectorId: string;
  sectorName?: string;
  compact?: boolean;
}

export function SectorUsersList({ sectorId, sectorName, compact = false }: SectorUsersListProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [additionalUsers, setAdditionalUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { isUserOnline } = useAllUsersPresence();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      
      // Fetch users with this as primary sector
      const { data: primaryUsers, error: primaryError } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, avatar_url, sector_id, user_status')
        .eq('sector_id', sectorId)
        .eq('is_active', true)
        .order('name');

      if (primaryError) {
        console.error('Error fetching primary sector users:', primaryError);
      } else {
        setUsers(primaryUsers || []);
      }

      // Fetch users with this as additional sector
      const { data: additionalData, error: additionalError } = await supabase
        .from('user_additional_sectors')
        .select('user_id')
        .eq('sector_id', sectorId);

      if (!additionalError && additionalData && additionalData.length > 0) {
        const userIds = additionalData.map(d => d.user_id);
        
        const { data: additionalProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, name, display_name, avatar_url, sector_id, user_status')
          .in('user_id', userIds)
          .eq('is_active', true)
          .order('name');

        if (!profilesError && additionalProfiles) {
          setAdditionalUsers(additionalProfiles);
        }
      }

      setLoading(false);
    };

    if (sectorId) {
      fetchUsers();
    }
  }, [sectorId]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const allUsers = [...users, ...additionalUsers];

  if (loading) {
    return (
      <Card className={cn(compact && 'border-0 shadow-none')}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {allUsers.map((user) => {
          const isOnline = isUserOnline(user.user_id);
          return (
            <div
              key={user.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || ''} alt={user.name} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                    isOnline ? 'bg-success' : 'bg-muted-foreground'
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.display_name || user.name}
                </p>
              </div>
              <UserStatusBadge status={user.user_status || 'available'} />
            </div>
          );
        })}
        {allUsers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum usuário neste setor
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          {sectorName ? `Usuários - ${sectorName}` : 'Usuários do Setor'}
          <Badge variant="secondary" className="ml-auto">
            {allUsers.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {allUsers.map((user, index) => {
              const isOnline = isUserOnline(user.user_id);
              const isPrimary = user.sector_id === sectorId;
              
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || ''} alt={user.name} />
                      <AvatarFallback>
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                        isOnline ? 'bg-success' : 'bg-muted-foreground'
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {user.display_name || user.name}
                      </p>
                      {!isPrimary && (
                        <Badge variant="outline" className="text-xs">
                          Adicional
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <UserStatusBadge status={user.user_status || 'available'} showLabel />
                      <span className="text-xs text-muted-foreground">
                        • {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {allUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado neste setor
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
