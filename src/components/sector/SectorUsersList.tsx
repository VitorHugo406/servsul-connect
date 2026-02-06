 import { useState, useEffect } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Users, X, Coffee, Briefcase, Clock, Moon, CheckCircle } from 'lucide-react';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { supabase } from '@/integrations/supabase/client';
 import { UserPreviewDialog } from '@/components/user/UserPreviewDialog';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from '@/components/user/PresenceIndicator';
 
interface SectorUser {
  id: string;
  user_id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  user_status: string | null;
  is_online?: boolean;
  last_heartbeat?: Date | null;
}
 
 interface SectorUsersListProps {
   sectorId: string;
  sectorName?: string;
  sectorColor?: string;
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
 }
 
 const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
   available: { label: 'Disponível', icon: CheckCircle, color: 'text-green-500' },
   lunch: { label: 'Almoçando', icon: Coffee, color: 'text-orange-500' },
   meeting: { label: 'Em reunião', icon: Briefcase, color: 'text-blue-500' },
   busy: { label: 'Ocupado', icon: Clock, color: 'text-red-500' },
   away: { label: 'Ausente', icon: Moon, color: 'text-gray-500' },
 };
 
export function SectorUsersList({ sectorId, sectorName, sectorColor, isOpen = true, onClose, inline = false }: SectorUsersListProps) {
   const [users, setUsers] = useState<SectorUser[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedUser, setSelectedUser] = useState<SectorUser | null>(null);
   const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [sector, setSector] = useState<{ name: string; color: string } | null>(null);
 
   useEffect(() => {
     if (!isOpen) return;
 
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';
        
        // Fetch sector info if not provided
        if (!sectorName || !sectorColor) {
          const { data: sectorData } = await supabase
            .from('sectors')
            .select('name, color')
            .eq('id', sectorId)
            .single();
          if (sectorData) {
            setSector(sectorData);
          }
        }

        let primaryUsers: any[] = [];

        if (sectorId === GERAL_SECTOR_ID) {
          // Geral sector: show ALL active users
          const { data, error } = await supabase
            .from('profiles')
            .select('id, user_id, name, display_name, avatar_url, user_status')
            .eq('is_active', true);
          if (error) throw error;
          primaryUsers = data || [];
        } else {
          // Get users from primary sector
          const { data, error } = await supabase
            .from('profiles')
            .select('id, user_id, name, display_name, avatar_url, user_status')
            .eq('sector_id', sectorId)
            .eq('is_active', true);
          if (error) throw error;
          primaryUsers = data || [];

          // Get users with additional sector access
          const { data: additionalSectorEntries, error: additionalError } = await supabase
            .from('user_additional_sectors')
            .select('user_id')
            .eq('sector_id', sectorId);
          if (additionalError) throw additionalError;

          if (additionalSectorEntries && additionalSectorEntries.length > 0) {
            const additionalUserIds = additionalSectorEntries.map(e => e.user_id);
            
            const { data: additionalProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, user_id, name, display_name, avatar_url, user_status')
              .in('user_id', additionalUserIds)
              .eq('is_active', true);
            if (profilesError) throw profilesError;

            additionalProfiles?.forEach(p => {
              if (!primaryUsers.find((u: any) => u.id === p.id)) {
                primaryUsers.push(p);
              }
            });
          }
        }

      // Get online status with heartbeat
        const { data: presenceData } = await supabase
          .from('user_presence')
          .select('user_id, is_online, last_heartbeat');

        const INACTIVE_THRESHOLD = 120000; // 2 minutes
        const presenceMap = new Map(presenceData?.map(p => {
          const lastHb = new Date(p.last_heartbeat);
          const timeSince = Date.now() - lastHb.getTime();
          return [p.user_id, { 
            is_online: p.is_online, 
            last_heartbeat: lastHb,
            isActive: p.is_online && timeSince < INACTIVE_THRESHOLD
          }];
        }) || []);

        // Map to final format
        const allUsers = primaryUsers.map(u => {
          const presence = presenceMap.get(u.user_id);
          return {
            ...u,
            is_online: presence?.is_online || false,
            last_heartbeat: presence?.last_heartbeat || null,
          };
        });

        setUsers(allUsers);
       } catch (error) {
         console.error('Error fetching sector users:', error);
       } finally {
         setLoading(false);
       }
     };
 
     fetchUsers();
 
     // Subscribe to presence changes
     const presenceChannel = supabase
       .channel('sector-presence')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'user_presence' },
          (payload) => {
            const presence = payload.new as { user_id: string; is_online: boolean; last_heartbeat: string };
            if (presence) {
              setUsers(prev => prev.map(u => 
                u.user_id === presence.user_id 
                  ? { ...u, is_online: presence.is_online, last_heartbeat: new Date(presence.last_heartbeat) }
                  : u
              ));
            }
          }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(presenceChannel);
     };
   }, [isOpen, sectorId]);

  const effectiveSectorName = sectorName || sector?.name || 'Setor';
  const effectiveSectorColor = sectorColor || sector?.color || '#6366f1';
 
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
   };
 
   const handleUserClick = (user: SectorUser) => {
     setSelectedUser(user);
     setShowProfileDialog(true);
   };
 
  const INACTIVE_THRESHOLD = 120000;
    const onlineUsers = users.filter(u => {
      if (!u.is_online) return false;
      if (u.last_heartbeat) {
        return Date.now() - u.last_heartbeat.getTime() < INACTIVE_THRESHOLD;
      }
      return true;
    });
    const awayUsers = users.filter(u => {
      if (!u.is_online) return false;
      if (u.last_heartbeat) {
        return Date.now() - u.last_heartbeat.getTime() >= INACTIVE_THRESHOLD;
      }
      return false;
    });
    const offlineUsers = users.filter(u => !u.is_online);
 
  // Inline version (for side panel)
  if (inline) {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div 
              className="h-6 w-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: effectiveSectorColor }}
            >
              {effectiveSectorName.charAt(0)}
            </div>
            <div>
              <h4 className="font-medium text-sm">{effectiveSectorName}</h4>
              <p className="text-xs text-muted-foreground">
                {users.length} membro{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum membro</p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {onlineUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Online ({onlineUsers.length})
                  </h4>
                  <div className="space-y-1">
                    {onlineUsers.map(user => {
                      const status = STATUS_CONFIG[user.user_status || 'available'];
                      const StatusIcon = status?.icon || CheckCircle;
                      return (
                        <button key={user.id} onClick={() => handleUserClick(user)} className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || ''} />
                              <AvatarFallback className="text-white text-xs" style={{ backgroundColor: effectiveSectorColor }}>{getInitials(user.display_name || user.name)}</AvatarFallback>
                            </Avatar>
                            <PresenceIndicator isOnline={user.is_online} lastHeartbeat={user.last_heartbeat} className="h-2.5 w-2.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate text-sm">{user.display_name || user.name}</p>
                            <div className="flex items-center gap-1 text-xs">
                              <StatusIcon className={cn('h-3 w-3', status?.color)} />
                              <span className={status?.color}>{status?.label}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {awayUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Ausente ({awayUsers.length})
                  </h4>
                  <div className="space-y-1">
                    {awayUsers.map(user => (
                      <button key={user.id} onClick={() => handleUserClick(user)} className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left opacity-75">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback className="text-white text-xs" style={{ backgroundColor: effectiveSectorColor }}>{getInitials(user.display_name || user.name)}</AvatarFallback>
                          </Avatar>
                          <PresenceIndicator isOnline={user.is_online} lastHeartbeat={user.last_heartbeat} className="h-2.5 w-2.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">{user.display_name || user.name}</p>
                          <p className="text-xs text-orange-500">Ausente</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {offlineUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    Offline ({offlineUsers.length})
                  </h4>
                  <div className="space-y-1">
                    {offlineUsers.map(user => (
                      <button key={user.id} onClick={() => handleUserClick(user)} className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left opacity-60">
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback className="text-white text-xs" style={{ backgroundColor: effectiveSectorColor }}>{getInitials(user.display_name || user.name)}</AvatarFallback>
                          </Avatar>
                          <PresenceIndicator isOnline={false} lastHeartbeat={null} className="h-2.5 w-2.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">{user.display_name || user.name}</p>
                          <p className="text-xs text-muted-foreground">Offline</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <UserPreviewDialog
          isOpen={showProfileDialog}
          onClose={() => {
            setShowProfileDialog(false);
            setSelectedUser(null);
          }}
          userId={selectedUser?.user_id || ''}
        />
      </div>
    );
  }

   return (
     <>
       <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="max-w-md max-h-[80vh]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-3">
               <div 
                 className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: effectiveSectorColor }}
               >
                {effectiveSectorName.charAt(0)}
               </div>
               <div>
                <span>{effectiveSectorName}</span>
                 <p className="text-xs text-muted-foreground font-normal">
                   {users.length} membro{users.length !== 1 ? 's' : ''}
                 </p>
               </div>
             </DialogTitle>
           </DialogHeader>
 
           {loading ? (
             <div className="flex items-center justify-center py-8">
               <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
             </div>
           ) : users.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
               <p>Nenhum membro neste setor</p>
             </div>
           ) : (
             <ScrollArea className="max-h-[60vh] pr-4">
               <div className="space-y-4">
                 {/* Online Users - with PresenceIndicator */}
                 {onlineUsers.length > 0 && (
                   <div>
                     <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-green-500" />
                       Online ({onlineUsers.length})
                     </h4>
                     <div className="space-y-1">
                       {onlineUsers.map(user => {
                         const status = STATUS_CONFIG[user.user_status || 'available'];
                         const StatusIcon = status?.icon || CheckCircle;
                         
                         return (
                           <motion.button
                             key={user.id}
                             onClick={() => handleUserClick(user)}
                             className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                             whileHover={{ scale: 1.01 }}
                             whileTap={{ scale: 0.99 }}
                           >
                             <div className="relative">
                               <Avatar className="h-10 w-10">
                                 <AvatarImage src={user.avatar_url || ''} />
                                 <AvatarFallback 
                                   className="text-white text-sm"
                                style={{ backgroundColor: effectiveSectorColor }}
                                 >
                                   {getInitials(user.display_name || user.name)}
                                 </AvatarFallback>
                               </Avatar>
                               <PresenceIndicator isOnline={user.is_online} lastHeartbeat={user.last_heartbeat} />
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="font-medium text-foreground truncate">
                                 {user.display_name || user.name}
                               </p>
                               <div className="flex items-center gap-1 text-xs">
                                 <StatusIcon className={cn('h-3 w-3', status?.color)} />
                                 <span className={status?.color}>{status?.label}</span>
                               </div>
                             </div>
                           </motion.button>
                         );
                       })}
                     </div>
                   </div>
                 )}
 
                  {/* Away Users */}
                  {awayUsers.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Ausente ({awayUsers.length})
                      </h4>
                      <div className="space-y-1">
                        {awayUsers.map(user => (
                          <motion.button key={user.id} onClick={() => handleUserClick(user)} className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left opacity-75" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <div className="relative">
                              <Avatar className="h-10 w-10"><AvatarImage src={user.avatar_url || ''} /><AvatarFallback className="text-white text-sm" style={{ backgroundColor: effectiveSectorColor }}>{getInitials(user.display_name || user.name)}</AvatarFallback></Avatar>
                              <PresenceIndicator isOnline={true} lastHeartbeat={user.last_heartbeat} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{user.display_name || user.name}</p>
                              <p className="text-xs text-orange-500">Ausente</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offline Users */}
                 {offlineUsers.length > 0 && (
                   <div>
                     <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-gray-400" />
                       Offline ({offlineUsers.length})
                     </h4>
                     <div className="space-y-1">
                       {offlineUsers.map(user => (
                         <motion.button
                           key={user.id}
                           onClick={() => handleUserClick(user)}
                           className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left opacity-60"
                           whileHover={{ scale: 1.01 }}
                           whileTap={{ scale: 0.99 }}
                         >
                           <div className="relative">
                             <Avatar className="h-10 w-10">
                               <AvatarImage src={user.avatar_url || ''} />
                               <AvatarFallback 
                                 className="text-white text-sm"
                              style={{ backgroundColor: effectiveSectorColor }}
                               >
                                 {getInitials(user.display_name || user.name)}
                               </AvatarFallback>
                             </Avatar>
                             <PresenceIndicator isOnline={false} lastHeartbeat={null} />
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="font-medium text-foreground truncate">
                               {user.display_name || user.name}
                             </p>
                             <p className="text-xs text-muted-foreground">Offline</p>
                           </div>
                         </motion.button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             </ScrollArea>
           )}
         </DialogContent>
       </Dialog>
 
       {/* User Preview Dialog */}
       <UserPreviewDialog
         isOpen={showProfileDialog}
         onClose={() => {
           setShowProfileDialog(false);
           setSelectedUser(null);
         }}
         userId={selectedUser?.user_id || ''}
       />
     </>
   );
 }