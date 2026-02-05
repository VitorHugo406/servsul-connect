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
 
 interface SectorUser {
   id: string;
   user_id: string;
   name: string;
   display_name: string | null;
   avatar_url: string | null;
   user_status: string | null;
   is_online?: boolean;
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
          const { data: additionalUsers, error: additionalError } = await supabase
            .from('user_additional_sectors')
            .select(`
              user_id,
              profiles!inner(id, user_id, name, display_name, avatar_url, user_status, is_active)
            `)
            .eq('sector_id', sectorId);
          if (additionalError) throw additionalError;

          // Merge additional users
          additionalUsers?.forEach(au => {
            const p = au.profiles as any;
            if (p && p.is_active && !primaryUsers.find((u: any) => u.id === p.id)) {
              primaryUsers.push({
                id: p.id,
                user_id: p.user_id,
                name: p.name,
                display_name: p.display_name,
                avatar_url: p.avatar_url,
                user_status: p.user_status,
              });
            }
          });
        }

        // Get online status
        const { data: presenceData } = await supabase
          .from('user_presence')
          .select('user_id, is_online');

        const presenceMap = new Map(presenceData?.map(p => [p.user_id, p.is_online]) || []);

        // Map to final format
        const allUsers = primaryUsers.map(u => ({
          ...u,
          is_online: presenceMap.get(u.user_id) || false,
        }));

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
           const presence = payload.new as { user_id: string; is_online: boolean };
           if (presence) {
             setUsers(prev => prev.map(u => 
               u.user_id === presence.user_id 
                 ? { ...u, is_online: presence.is_online }
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
 
   const onlineUsers = users.filter(u => u.is_online);
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
                        <button
                          key={user.id}
                          onClick={() => handleUserClick(user)}
                          className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url || ''} />
                              <AvatarFallback 
                                className="text-white text-xs"
                                style={{ backgroundColor: effectiveSectorColor }}
                              >
                                {getInitials(user.display_name || user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate text-sm">
                              {user.display_name || user.name}
                            </p>
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

              {offlineUsers.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 px-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                    Offline ({offlineUsers.length})
                  </h4>
                  <div className="space-y-1">
                    {offlineUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        className="flex w-full items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left opacity-60"
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback 
                              className="text-white text-xs"
                              style={{ backgroundColor: effectiveSectorColor }}
                            >
                              {getInitials(user.display_name || user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">
                            {user.display_name || user.name}
                          </p>
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
                 {/* Online Users */}
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
                               <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
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
                             <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-gray-400" />
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