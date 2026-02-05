 import { useState, useEffect } from 'react';
 import { Coffee, Briefcase, Clock, Moon, CheckCircle, Building2, Calendar, Mail, Phone } from 'lucide-react';
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Badge } from '@/components/ui/badge';
 import { Separator } from '@/components/ui/separator';
 import { supabase } from '@/integrations/supabase/client';
 import { cn } from '@/lib/utils';
 
 interface UserProfile {
   id: string;
   name: string;
   display_name: string | null;
   email: string;
   avatar_url: string | null;
   user_status: string | null;
   sector_id: string | null;
   birth_date: string | null;
   phone: string | null;
   work_period: string | null;
   autonomy_level: string;
 }
 
 interface UserPreviewDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
   userId: string;
  profileId?: string;
 }
 
 const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
   available: { label: 'Disponível', icon: CheckCircle, color: 'text-green-500' },
   lunch: { label: 'Almoçando', icon: Coffee, color: 'text-orange-500' },
   meeting: { label: 'Em reunião', icon: Briefcase, color: 'text-blue-500' },
   busy: { label: 'Ocupado', icon: Clock, color: 'text-red-500' },
   away: { label: 'Ausente', icon: Moon, color: 'text-muted-foreground' },
 };
 
 const AUTONOMY_LABELS: Record<string, string> = {
   admin: 'Administrador',
   gerente: 'Gerente',
   gestor: 'Gestor',
   diretoria: 'Diretoria',
   supervisor: 'Supervisor',
   colaborador: 'Colaborador',
 };
 
export function UserPreviewDialog({ open, isOpen, onOpenChange, onClose, userId, profileId }: UserPreviewDialogProps) {
   const [user, setUser] = useState<UserProfile | null>(null);
   const [sector, setSector] = useState<{ name: string; color: string } | null>(null);
   const [loading, setLoading] = useState(true);
   const [isOnline, setIsOnline] = useState(false);
 
  const dialogOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!newOpen && onClose) onClose();
  };

  const targetId = profileId || userId;

   useEffect(() => {
    if (!dialogOpen || !targetId) return;
 
     const fetchUser = async () => {
       setLoading(true);
       try {
        // Try to fetch by profile id first, then by user_id
         const { data: profileData, error } = await supabase
           .from('profiles')
           .select('*')
          .or(`id.eq.${targetId},user_id.eq.${targetId}`)
           .single();
 
         if (error) throw error;
         setUser(profileData);
 
         if (profileData?.sector_id) {
           const { data: sectorData } = await supabase
             .from('sectors')
             .select('name, color')
             .eq('id', profileData.sector_id)
             .single();
           setSector(sectorData);
         }
 
         // Check online status
         const { data: presenceData } = await supabase
           .from('user_presence')
           .select('is_online')
          .eq('user_id', profileData?.user_id)
           .single();
         setIsOnline(presenceData?.is_online || false);
       } catch (error) {
         console.error('Error fetching user:', error);
       } finally {
         setLoading(false);
       }
     };
 
     fetchUser();
  }, [dialogOpen, targetId]);
 
   const getInitials = (name: string) => {
     return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
   };
 
   const status = STATUS_CONFIG[user?.user_status || 'available'];
   const StatusIcon = status?.icon || CheckCircle;
 
   return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
       <DialogContent className="max-w-sm">
         {loading ? (
           <div className="flex items-center justify-center py-12">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
           </div>
         ) : user ? (
           <>
             <DialogHeader className="items-center text-center">
               <div className="relative mb-2">
                 <Avatar className="h-20 w-20">
                   <AvatarImage src={user.avatar_url || ''} />
                   <AvatarFallback 
                     className="text-xl text-white"
                     style={{ backgroundColor: sector?.color || 'hsl(var(--primary))' }}
                   >
                     {getInitials(user.display_name || user.name)}
                   </AvatarFallback>
                 </Avatar>
                 <span 
                   className={cn(
                     'absolute bottom-0 right-0 h-5 w-5 rounded-full border-4 border-background',
                     isOnline ? 'bg-green-500' : 'bg-muted-foreground'
                   )} 
                 />
               </div>
               <DialogTitle className="text-xl">
                 {user.display_name || user.name}
               </DialogTitle>
               <Badge variant="secondary">
                 {AUTONOMY_LABELS[user.autonomy_level] || 'Colaborador'}
               </Badge>
             </DialogHeader>
 
             <div className="space-y-4">
               {/* Status */}
               <div className="flex items-center justify-center gap-2 py-2">
                 <StatusIcon className={cn('h-5 w-5', status?.color)} />
                 <span className={cn('font-medium', status?.color)}>
                   {status?.label || 'Disponível'}
                 </span>
               </div>
 
               <Separator />
 
               {/* Info */}
               <div className="space-y-3">
                 {sector && (
                   <div className="flex items-center gap-3">
                     <div 
                       className="h-8 w-8 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: sector.color + '20' }}
                     >
                       <Building2 className="h-4 w-4" style={{ color: sector.color }} />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Setor</p>
                       <p className="font-medium text-foreground">{sector.name}</p>
                     </div>
                   </div>
                 )}
 
                 {user.work_period && (
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                       <Clock className="h-4 w-4 text-muted-foreground" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Turno</p>
                       <p className="font-medium text-foreground">{user.work_period}</p>
                     </div>
                   </div>
                 )}
 
                 <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                     <Mail className="h-4 w-4 text-muted-foreground" />
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground">Email</p>
                     <p className="font-medium text-foreground text-sm truncate">{user.email}</p>
                   </div>
                 </div>
 
                 {user.phone && (
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                       <Phone className="h-4 w-4 text-muted-foreground" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Telefone</p>
                       <p className="font-medium text-foreground">{user.phone}</p>
                     </div>
                   </div>
                 )}
 
                 {user.birth_date && (
                   <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
                       <Calendar className="h-4 w-4 text-muted-foreground" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">Aniversário</p>
                       <p className="font-medium text-foreground">
                         {new Date(user.birth_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                           day: 'numeric',
                           month: 'long'
                         })}
                       </p>
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </>
         ) : (
           <div className="text-center py-8 text-muted-foreground">
             Usuário não encontrado
           </div>
         )}
       </DialogContent>
     </Dialog>
   );
 }