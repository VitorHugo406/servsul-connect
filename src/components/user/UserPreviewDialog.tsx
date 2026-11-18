import { PUBLIC_PROFILE_COLUMNS } from '@/lib/profileColumns';
 import { useState, useEffect } from 'react';
 import { Coffee, Briefcase, Clock, Moon, CheckCircle, Building2, Calendar, Mail, Phone, CalendarClock, BadgeCheck, MessageSquareQuote } from 'lucide-react';
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
   user_id?: string;
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
   cover_url?: string | null;
   description?: string | null;
   created_at?: string | null;
   work_start?: string | null;
   work_end?: string | null;
   work_days?: number[] | boolean[] | null;
   status_until?: string | null;
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
    away: { label: 'Fora de expediente', icon: Moon, color: 'text-muted-foreground' },
    vacation: { label: 'De férias', icon: Moon, color: 'text-blue-500' },
    leave: { label: 'De afastamento', icon: Clock, color: 'text-red-500' },
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
         const { data: rawProfile, error } = await supabase
           .from('profiles')
           .select(PUBLIC_PROFILE_COLUMNS)
          .or(`id.eq.${targetId},user_id.eq.${targetId}`)
           .single();
         const profileData = rawProfile as unknown as UserProfile | null;
 
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
       <DialogContent className="max-w-md overflow-hidden p-6">
         {loading ? (
           <div className="flex items-center justify-center py-12">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
           </div>
         ) : user ? (() => {
           const name = user.display_name || user.name;
           const col = sector?.color || 'hsl(var(--primary))';
           const cover = user.cover_url && /^(https?:|data:|blob:)/.test(user.cover_url) ? user.cover_url : null;
           const hhmm = (v?: string | null) => (v ? String(v).slice(0, 5) : '');
           const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
           const days = Array.isArray(user.work_days) ? (user.work_days as unknown[]).map((d, i) => (typeof d === 'number' ? DAYS[(d + 6) % 7] : d ? DAYS[i] : '')).filter(Boolean) : [];
           const hours = user.work_start && user.work_end ? `${hhmm(user.work_start)} às ${hhmm(user.work_end)}${days.length ? ` · ${days.length === 5 && days.join() === 'Seg,Ter,Qua,Qui,Sex' ? 'Seg a Sex' : days.join(', ')}` : ''}` : user.work_period || '';
           const since = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '';
           const until = user.status_until && new Date(user.status_until).getTime() > Date.now() ? new Date(user.status_until).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
           const Row = ({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) => (
             <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
               <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
               <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate text-sm font-medium text-foreground" title={value}>{value}</p></div>
             </div>
           );
           return (
             <div className="-m-6">
               <div className="relative h-32 w-full overflow-hidden rounded-t-lg" style={cover ? undefined : { background: `linear-gradient(135deg, ${col}, color-mix(in srgb, ${col} 45%, #0f172a))` }}>
                 {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : null}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
               </div>
               <div className="px-6 pb-6">
                 <div className="-mt-12 flex items-end justify-between gap-3">
                   <div className="relative">
                     <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                       <AvatarImage src={user.avatar_url || ''} className="object-cover" />
                       <AvatarFallback className="text-2xl text-white" style={{ backgroundColor: col }}>{getInitials(name)}</AvatarFallback>
                     </Avatar>
                     <span className={cn('absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full border-4 border-background', isOnline ? 'bg-green-500' : 'bg-muted-foreground')} title={isOnline ? 'Online' : 'Offline'} />
                   </div>
                   <span className={cn('mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium', status?.color)}>
                     <StatusIcon className="h-3.5 w-3.5" />{status?.label || 'Disponível'}{until ? <span className="text-muted-foreground"> · até {until}</span> : null}
                   </span>
                 </div>
                 <div className="mt-3 space-y-1 text-left">
                   <DialogTitle className="text-xl leading-tight">{name}</DialogTitle>
                   <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                     <Badge variant="secondary" className="gap-1"><BadgeCheck className="h-3 w-3" />{AUTONOMY_LABELS[user.autonomy_level] || 'Colaborador'}</Badge>
                     {sector ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: sector.color }} />{sector.name}</span> : null}
                     <span>{isOnline ? 'Online agora' : 'Offline'}</span>
                   </div>
                 </div>
                 {user.description ? <p className="mt-3 flex gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm text-foreground"><MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span className="whitespace-pre-line">{user.description}</span></p> : null}
                 <Separator className="my-4" />
                 <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                   {sector ? <Row icon={Building2} label="Setor" value={sector.name} /> : null}
                   <Row icon={Mail} label="E-mail" value={user.email} />
                   {user.phone ? <Row icon={Phone} label="Telefone" value={user.phone} /> : null}
                   {hours ? <Row icon={Clock} label="Expediente" value={hours} /> : null}
                   {user.birth_date ? <Row icon={Calendar} label="Aniversário" value={new Date(user.birth_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} /> : null}
                   {since ? <Row icon={CalendarClock} label="No sistema desde" value={since} /> : null}
                 </div>
               </div>
             </div>
           );
         })() : (
           <div className="text-center py-8 text-muted-foreground">
             Usuário não encontrado
           </div>
         )}
       </DialogContent>
     </Dialog>
   );
 }