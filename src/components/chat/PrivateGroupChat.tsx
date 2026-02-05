 import { useEffect, useRef, useState } from 'react';
 import { motion } from 'framer-motion';
 import { Users, Settings, UserPlus, Check, CheckCheck, Crown, Loader2, Trash2 } from 'lucide-react';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Badge } from '@/components/ui/badge';
 import { 
   Sheet, 
   SheetContent, 
   SheetDescription, 
   SheetHeader, 
   SheetTitle, 
   SheetTrigger 
 } from '@/components/ui/sheet';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { ChatInput } from '@/components/chat/ChatInput';
 import { useGroupMessages, useGroupMembers, PrivateGroup } from '@/hooks/usePrivateGroups';
 import { useActiveUsers } from '@/hooks/useDirectMessages';
 import { useSectors } from '@/hooks/useData';
 import { useAuth } from '@/contexts/AuthContext';
 import { useSound } from '@/hooks/useSound';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 interface PrivateGroupChatProps {
   group: PrivateGroup | null;
 }
 
 export function PrivateGroupChat({ group }: PrivateGroupChatProps) {
   const { profile, user } = useAuth();
   const { messages, loading, sendMessage } = useGroupMessages(group?.id || null);
   const { members, addMember, removeMember, updateMemberRole, refetch: refetchMembers } = useGroupMembers(group?.id || null);
   const { users } = useActiveUsers();
   const { sectors } = useSectors();
   const { playMessageSent } = useSound();
   const scrollRef = useRef<HTMLDivElement>(null);
   const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
   const [addingMember, setAddingMember] = useState<string | null>(null);
 
   const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');
   const currentMember = members.find(m => m.user_id === user?.id);
 
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollIntoView({ behavior: 'smooth' });
     }
   }, [messages]);
 
   const getInitials = (name: string) => {
     return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
   };
 
   const formatTime = (dateStr: string) => {
     const date = new Date(dateStr);
     return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
   };
 
   const handleSendMessage = async (content: string) => {
     playMessageSent();
     const { error } = await sendMessage(content);
     if (error) {
       console.error('Error sending message:', error);
     }
   };
 
   const handleAddMember = async (userId: string, profileId: string) => {
     setAddingMember(profileId);
     const { error } = await addMember(userId, profileId);
     setAddingMember(null);
     
     if (error) {
       toast.error('Erro ao adicionar membro');
     } else {
       toast.success('Membro adicionado!');
     }
   };
 
   const handleRemoveMember = async (memberId: string) => {
     const { error } = await removeMember(memberId);
     if (error) {
       toast.error('Erro ao remover membro');
     } else {
       toast.success('Membro removido');
     }
   };
 
   const handleToggleAdmin = async (memberId: string, currentRole: string) => {
     const newRole = currentRole === 'admin' ? 'member' : 'admin';
     const { error } = await updateMemberRole(memberId, newRole);
     if (error) {
       toast.error('Erro ao atualizar permissão');
     } else {
       toast.success(newRole === 'admin' ? 'Agora é administrador!' : 'Removido como administrador');
     }
   };
 
   // Filter users not in group
   const availableUsers = users.filter(u => 
     !members.some(m => m.profile_id === u.id)
   );
 
   if (!group) {
     return (
       <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-8 text-center">
         <div className="mb-4 rounded-full bg-muted p-6">
           <Users className="h-12 w-12 text-muted-foreground" />
         </div>
         <h3 className="font-display text-xl font-semibold text-foreground">
           Selecione um grupo
         </h3>
         <p className="mt-2 text-muted-foreground">
           Escolha um grupo para iniciar uma conversa
         </p>
       </div>
     );
   }
 
   return (
     <div className="flex h-full flex-col">
       {/* Chat Header */}
       <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
         <div className="flex items-center gap-3">
           <Avatar className="h-10 w-10">
             <AvatarImage src={group.avatar_url || ''} />
             <AvatarFallback className="bg-primary text-primary-foreground">
               {getInitials(group.name)}
             </AvatarFallback>
           </Avatar>
           <div>
             <h3 className="font-display font-semibold text-foreground">{group.name}</h3>
             <p className="text-xs text-muted-foreground">
               {members.length} membros
             </p>
           </div>
         </div>
 
         <Sheet>
           <SheetTrigger asChild>
             <Button variant="ghost" size="icon">
               <Settings className="h-5 w-5" />
             </Button>
           </SheetTrigger>
           <SheetContent className="w-full sm:max-w-md">
             <SheetHeader>
               <SheetTitle>Configurações do Grupo</SheetTitle>
               <SheetDescription>
                 Gerencie os membros e configurações
               </SheetDescription>
             </SheetHeader>
             
             <div className="mt-6 space-y-6">
               {/* Group Info */}
               <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16">
                   <AvatarImage src={group.avatar_url || ''} />
                   <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                     {getInitials(group.name)}
                   </AvatarFallback>
                 </Avatar>
                 <div>
                   <h3 className="font-semibold text-lg">{group.name}</h3>
                   {group.description && (
                     <p className="text-sm text-muted-foreground">{group.description}</p>
                   )}
                 </div>
               </div>
 
               {/* Add Member Button */}
               {isAdmin && (
                 <Button 
                   onClick={() => setShowAddMemberDialog(true)} 
                   className="w-full gap-2"
                 >
                   <UserPlus className="h-4 w-4" />
                   Adicionar Membro
                 </Button>
               )}
 
               {/* Members List */}
               <div>
                 <h4 className="font-medium mb-3">Membros ({members.length})</h4>
                 <ScrollArea className="h-[300px]">
                   <div className="space-y-2">
                     {members.map((member) => {
                       const memberProfile = member.profile;
                       const sector = sectors.find(s => s.id === memberProfile?.sector_id);
                       const displayName = memberProfile?.display_name || memberProfile?.name || 'Usuário';
                       const isCurrentUser = member.user_id === user?.id;
 
                       return (
                         <div
                           key={member.id}
                           className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                         >
                           <Avatar className="h-10 w-10">
                             <AvatarImage src={memberProfile?.avatar_url || ''} />
                             <AvatarFallback
                               className="text-sm text-white"
                               style={{ backgroundColor: sector?.color || '#6366f1' }}
                             >
                               {getInitials(displayName)}
                             </AvatarFallback>
                           </Avatar>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                               <span className="font-medium truncate">{displayName}</span>
                               {member.role === 'admin' && (
                                 <Crown className="h-4 w-4 text-yellow-500" />
                               )}
                             </div>
                             <p className="text-xs text-muted-foreground">
                               {memberProfile?.user_status === 'available' ? 'Disponível' :
                                memberProfile?.user_status === 'lunch' ? 'Almoçando' :
                                memberProfile?.user_status === 'meeting' ? 'Em reunião' :
                                memberProfile?.user_status === 'busy' ? 'Ocupado' :
                                memberProfile?.user_status === 'away' ? 'Ausente' : 'Disponível'}
                             </p>
                           </div>
                           {isAdmin && !isCurrentUser && (
                             <div className="flex gap-1">
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-8 w-8"
                                 onClick={() => handleToggleAdmin(member.id, member.role)}
                                 title={member.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                               >
                                 <Crown className={cn(
                                   "h-4 w-4",
                                   member.role === 'admin' ? 'text-yellow-500' : 'text-muted-foreground'
                                 )} />
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-8 w-8 text-destructive"
                                 onClick={() => handleRemoveMember(member.id)}
                               >
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 </ScrollArea>
               </div>
             </div>
           </SheetContent>
         </Sheet>
       </div>
 
       {/* Messages */}
       <ScrollArea className="flex-1 p-4">
         {loading ? (
           <div className="flex justify-center py-8">
             <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
           </div>
         ) : messages.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="mb-4 rounded-full bg-muted p-4">
               <span className="text-4xl">👋</span>
             </div>
             <h4 className="font-display text-lg font-semibold text-foreground">
               Inicie a conversa
             </h4>
             <p className="text-sm text-muted-foreground">
               Envie a primeira mensagem do grupo!
             </p>
           </div>
         ) : (
           <div className="space-y-4">
             {messages.map((message, index) => {
               const isOwn = message.sender_id === profile?.id;
               const sender = message.sender;
               const senderSector = sectors.find(s => s.id === sender?.sector_id);
               const senderName = sender?.display_name || sender?.name || 'Usuário';
 
               return (
                 <motion.div
                   key={message.id}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: index * 0.02, duration: 0.2 }}
                   className={cn('flex gap-3', isOwn && 'flex-row-reverse')}
                 >
                   <Avatar className="h-8 w-8 flex-shrink-0">
                     <AvatarImage src={sender?.avatar_url || ''} />
                     <AvatarFallback
                       className="text-xs text-white"
                       style={{ backgroundColor: senderSector?.color || '#6366f1' }}
                     >
                       {getInitials(senderName)}
                     </AvatarFallback>
                   </Avatar>
 
                   <div className={cn('flex flex-col', isOwn && 'items-end')}>
                     <div className={cn('mb-1 flex items-center gap-2', isOwn && 'flex-row-reverse')}>
                       <span className="text-xs font-medium text-foreground">
                         {senderName}
                       </span>
                       <span className="text-xs text-muted-foreground">
                         {formatTime(message.created_at)}
                       </span>
                     </div>
 
                     <div
                       className={cn(
                         'rounded-2xl px-4 py-2.5 shadow-sm max-w-[min(70vw,400px)] w-fit',
                         isOwn
                           ? 'gradient-primary text-white rounded-tr-md'
                           : 'bg-card text-card-foreground rounded-tl-md border border-border'
                       )}
                     >
                       <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                         {message.content}
                         {isOwn && (
                           <span className="ml-1 inline-flex items-center">
                             {message.id.startsWith('temp-') ? (
                               <Check className="h-3.5 w-3.5 text-white/60" />
                             ) : (
                               <CheckCheck className="h-3.5 w-3.5 text-white/80" />
                             )}
                           </span>
                         )}
                       </p>
                     </div>
                   </div>
                 </motion.div>
               );
             })}
             <div ref={scrollRef} />
           </div>
         )}
       </ScrollArea>
 
       {/* Input */}
       {currentMember && <ChatInput onSendMessage={handleSendMessage} />}
 
       {/* Add Member Dialog */}
       <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Adicionar Membro</DialogTitle>
             <DialogDescription>
               Selecione um usuário para adicionar ao grupo
             </DialogDescription>
           </DialogHeader>
           <ScrollArea className="max-h-[400px]">
             <div className="space-y-2 p-1">
               {availableUsers.length === 0 ? (
                 <p className="text-center text-sm text-muted-foreground py-4">
                   Todos os usuários já estão no grupo
                 </p>
               ) : (
                 availableUsers.map((availableUser) => {
                   const sector = sectors.find(s => s.id === availableUser.sector_id);
                   const displayName = availableUser.display_name || availableUser.name;
                   const isLoading = addingMember === availableUser.id;
                                  const userId = (availableUser as any).user_id;
 
                   return (
                     <button
                       key={availableUser.id}
                                      onClick={() => handleAddMember(userId, availableUser.id)}
                       disabled={!!addingMember}
                       className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-muted transition-colors disabled:opacity-50"
                     >
                       <Avatar className="h-10 w-10">
                         <AvatarImage src={availableUser.avatar_url || ''} />
                         <AvatarFallback
                           className="text-sm text-white"
                           style={{ backgroundColor: sector?.color || '#6366f1' }}
                         >
                           {getInitials(displayName)}
                         </AvatarFallback>
                       </Avatar>
                       <div className="flex-1">
                         <span className="font-medium text-foreground">{displayName}</span>
                         {sector && (
                           <p className="text-xs text-muted-foreground">{sector.name}</p>
                         )}
                       </div>
                       {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                     </button>
                   );
                 })
               )}
             </div>
           </ScrollArea>
         </DialogContent>
       </Dialog>
     </div>
   );
 }