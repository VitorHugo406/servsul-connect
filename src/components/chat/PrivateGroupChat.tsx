import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Settings, UserPlus, Check, CheckCheck, Crown, Loader2, Trash2, Image, Eye, Palette } from 'lucide-react';
import { ScheduledSummaryConfig } from '@/components/chat/ScheduledSummaryConfig';
import { ChatMediaFilter } from '@/components/chat/ChatMediaFilter';
import { Separator } from '@/components/ui/separator';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChatInput } from '@/components/chat/ChatInput';
import { useGroupMessages, useGroupMembers, PrivateGroup, usePrivateGroups } from '@/hooks/usePrivateGroups';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useSound } from '@/hooks/useSound';
import { UserPreviewDialog } from '@/components/user/UserPreviewDialog';
import { formatText } from '@/lib/chatFormatUtils';
import { cn } from '@/lib/utils';
import { SignedStorageImage, SignedStorageLink } from '@/components/common/SignedStorageMedia';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChatPersonalizationDialog, getChatBackgroundKey } from '@/components/chat/ChatPersonalizationDialog';

interface PrivateGroupChatProps { group: PrivateGroup | null; }

export function PrivateGroupChat({ group }: PrivateGroupChatProps) {
  const { profile, user } = useAuth();
  const { messages, loading, sendMessage } = useGroupMessages(group?.id || null);
  const { members, addMember, removeMember, updateMemberRole } = useGroupMembers(group?.id || null);
  const { updateGroup, deleteGroup } = usePrivateGroups();
  const { users } = useActiveUsers();
  const { sectors } = useSectors();
  const { playMessageSent } = useSound();
  const scrollRef = useRef<HTMLDivElement>(null);
  const mentionedUsersRef = useRef<{id: string; name: string}[]>([]);
  const { typingUsers, sendTyping } = useTypingIndicator(`group-${group?.id || 'none'}`);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [showEditAvatarDialog, setShowEditAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [chatBackground, setChatBackground] = useState('');

  const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');
  const currentMember = members.find(m => m.user_id === user?.id);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (group?.avatar_url) setAvatarUrl(group.avatar_url); }, [group?.avatar_url]);
  useEffect(() => {
    if (!group?.id) { setChatBackground(''); return; }
    const load = () => setChatBackground(localStorage.getItem(getChatBackgroundKey(`group-${group.id}`)) || '');
    load();
    const handler = (event: Event) => { const e = event as CustomEvent<{ chatId?: string; background?: string }>; if (e.detail?.chatId === `group-${group.id}`) setChatBackground(e.detail.background || ''); };
    window.addEventListener('nuvexa:chat-background-changed', handler);
    return () => window.removeEventListener('nuvexa:chat-background-changed', handler);
  }, [group?.id]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const renderMessageContent = (content: string, isOwn: boolean) => {
    const lines = content.split('\n'); const textLines: string[] = []; const atts: { type: 'image' | 'file'; name: string; url: string }[] = [];
    for (const line of lines) { const imageMatch = line.match(/^📷 \[(.+?)\]\((.+?)\)$/); const fileMatch = line.match(/^📎 \[(.+?)\]\((.+?)\)$/); if (imageMatch) atts.push({ type: 'image', name: imageMatch[1], url: imageMatch[2] }); else if (fileMatch) atts.push({ type: 'file', name: fileMatch[1], url: fileMatch[2] }); else textLines.push(line); }
    const textContent = textLines.join('\n').trim();
    return <div className="space-y-2">{textContent && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{textContent.split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{formatText(line, isOwn)}</React.Fragment>)}</p>}{atts.map((att, i) => att.type === 'image' ? <SignedStorageLink key={i} url={att.url}><SignedStorageImage url={att.url} alt={att.name} className="max-w-full max-h-48 rounded-2xl object-cover" /></SignedStorageLink> : <SignedStorageLink key={i} url={att.url} className={cn('flex items-center gap-2 rounded-2xl p-2 text-xs', isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80')}><span>📎</span><span className="truncate">{att.name}</span></SignedStorageLink>)}</div>;
  };
  const handleMention = useCallback((userId: string, userName: string) => { mentionedUsersRef.current.push({ id: userId, name: userName }); }, []);
  const sendMentionNotifications = useCallback(async (content: string) => {
    if (!profile || mentionedUsersRef.current.length === 0) return; const mentioned = [...mentionedUsersRef.current]; mentionedUsersRef.current = [];
    for (const m of mentioned) { if (!content.includes(`@${m.name}`)) continue; const { data: mp } = await supabase.from('profiles').select('user_id').eq('id', m.id).single(); if (!mp) continue; await supabase.rpc('create_user_notification' as any, { _target_user_id: mp.user_id, _type: 'mention', _title: 'Você foi mencionado', _message: `${profile.display_name || profile.name} mencionou você em ${group?.name || 'grupo'}: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`, _reference_id: group?.id || null }); }
  }, [profile, group]);
  const handleSendMessage = async (content: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[]) => { playMessageSent(); let fullContent = content; if (attachments?.length) fullContent += attachments.map(a => a.fileType.startsWith('image/') ? `\n📷 [${a.fileName}](${a.url})` : `\n📎 [${a.fileName}](${a.url})`).join(''); const { error } = await sendMessage(fullContent); if (error) console.error('Error sending message:', error); else await sendMentionNotifications(fullContent); };
  const handleAddMember = async (userId: string, profileId: string) => { setAddingMember(profileId); const { error } = await addMember(userId, profileId); setAddingMember(null); error ? toast.error('Erro ao adicionar membro') : toast.success('Membro adicionado!'); };
  const handleRemoveMember = async (memberId: string) => { const { error } = await removeMember(memberId); error ? toast.error('Erro ao remover membro') : toast.success('Membro removido'); };
  const handleToggleAdmin = async (memberId: string, currentRole: string) => { const newRole = currentRole === 'admin' ? 'member' : 'admin'; const { error } = await updateMemberRole(memberId, newRole); error ? toast.error('Erro ao atualizar permissão') : toast.success(newRole === 'admin' ? 'Agora é administrador!' : 'Removido como administrador'); };
  const handleUpdateAvatar = async () => { if (!group) return; const { error } = await updateGroup(group.id, { avatar_url: avatarUrl }); if (error) toast.error('Erro ao atualizar imagem'); else { toast.success('Imagem atualizada!'); setShowEditAvatarDialog(false); } };
  const handleDeleteGroup = async () => { if (!group) return; setDeletingGroup(true); const { error } = await deleteGroup(group.id); setDeletingGroup(false); if (error) toast.error('Erro ao excluir grupo'); else { toast.success('Grupo excluído com sucesso!'); setShowDeleteGroupDialog(false); } };
  const availableUsers = users.filter((u: any) => !members.some(m => m.profile_id === u.id));
  const getStatusLabel = (status: string | null | undefined) => ({ available: 'Disponível', lunch: 'Almoçando', meeting: 'Em reunião', busy: 'Ocupado', away: 'Fora de expediente', vacation: 'De férias', leave: 'De afastamento', working: 'Trabalhando' } as Record<string,string>)[status || ''] || 'Disponível';
  const getStatusColor = (status: string | null | undefined) => ({ available: 'text-green-500', lunch: 'text-orange-500', meeting: 'text-blue-500', busy: 'text-red-500', away: 'text-gray-500', vacation: 'text-blue-500', leave: 'text-red-500', working: 'text-emerald-500' } as Record<string,string>)[status || ''] || 'text-green-500';
  const backgroundStyle = chatBackground ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), url(${chatBackground})` } : undefined;

  if (!group) return <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-8 text-center"><div className="mb-4 rounded-full bg-muted p-6"><Users className="h-12 w-12 text-muted-foreground" /></div><h3 className="font-display text-xl font-semibold text-foreground">Selecione um grupo</h3><p className="mt-2 text-muted-foreground">Escolha um grupo para iniciar uma conversa</p></div>;

  return <div className="flex h-full flex-col min-h-0">
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3 min-w-0"><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={group.avatar_url || ''} /><AvatarFallback className="bg-primary text-primary-foreground">{getInitials(group.name)}</AvatarFallback></Avatar><div className="min-w-0"><h3 className="font-display font-semibold text-foreground truncate">{group.name}</h3><p className="text-xs text-muted-foreground">{members.length} membros</p></div></div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" title="Personalizar chat" onClick={() => setShowPersonalization(true)}><Palette className="h-5 w-5" /></Button>
        <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button></SheetTrigger><SheetContent className="w-full sm:max-w-md flex flex-col"><SheetHeader className="border-b border-border pb-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Settings className="h-5 w-5 text-primary" /></div><div><SheetTitle>Configurações do Grupo</SheetTitle><SheetDescription className="text-xs">Gerencie membros, mídia e automações</SheetDescription></div></div></SheetHeader><ScrollArea className="flex-1 -mx-6 px-6"><div className="mt-4 space-y-5 pb-6">
          <div className="flex items-center gap-4"><Avatar className="h-16 w-16"><AvatarImage src={group.avatar_url || ''} /><AvatarFallback className="bg-primary text-primary-foreground text-xl">{getInitials(group.name)}</AvatarFallback></Avatar><div><h3 className="font-semibold text-lg">{group.name}</h3>{group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}</div>{isAdmin && <Button variant="outline" size="sm" onClick={() => setShowEditAvatarDialog(true)} className="ml-auto gap-1"><Image className="h-4 w-4" />Editar</Button>}</div>
          {isAdmin && <Button onClick={() => setShowAddMemberDialog(true)} className="w-full gap-2"><UserPlus className="h-4 w-4" />Adicionar Membro</Button>}
          <div><h4 className="font-medium mb-3">Membros ({members.length})</h4><ScrollArea className="h-[300px]"><div className="space-y-2">{members.map(member => { const memberProfile = member.profile; const sector = sectors.find(s => s.id === memberProfile?.sector_id); const displayName = memberProfile?.display_name || memberProfile?.name || 'Usuário'; const isCurrentUser = member.user_id === user?.id; return <div key={member.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-muted cursor-pointer" onClick={() => !isCurrentUser && setPreviewUserId(memberProfile?.id || null)}><Avatar className="h-10 w-10"><AvatarImage src={memberProfile?.avatar_url || ''} /><AvatarFallback className="text-sm text-white" style={{ backgroundColor: sector?.color || '#6366f1' }}>{getInitials(displayName)}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-medium truncate">{displayName}</span>{member.role === 'admin' && <Crown className="h-4 w-4 text-yellow-500" />}</div><p className={cn('text-xs', getStatusColor(memberProfile?.user_status))}>{getStatusLabel(memberProfile?.user_status)}</p></div>{!isCurrentUser && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setPreviewUserId(memberProfile?.id || null); }}><Eye className="h-4 w-4" /></Button>}{isAdmin && !isCurrentUser && <div className="flex gap-1" onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleAdmin(member.id, member.role)} title={member.role === 'admin' ? 'Remover admin' : 'Tornar admin'}><Crown className={cn('h-4 w-4', member.role === 'admin' ? 'text-yellow-500' : 'text-muted-foreground')} /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveMember(member.id)}><Trash2 className="h-4 w-4" /></Button></div>}</div>; })}</div></ScrollArea></div>
          <Separator className="my-2" /><div><h4 className="font-medium mb-3">Mídia e Arquivos</h4><ChatMediaFilter chatType="group" chatId={group.id} /></div>
          {isAdmin && <><Separator className="my-2" /><ScheduledSummaryConfig targetType="group" targetId={group.id} targetName={group.name} /><Button variant="destructive" className="w-full gap-2" onClick={() => setShowDeleteGroupDialog(true)}><Trash2 className="h-4 w-4" />Excluir Grupo</Button></>}
        </div></ScrollArea></SheetContent></Sheet>
      </div>
    </div>
    <div className="min-h-0 flex-1 bg-cover bg-center bg-fixed" style={backgroundStyle}><ScrollArea className="h-full p-4">{loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : messages.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 rounded-full bg-muted p-4"><span className="text-4xl">👋</span></div><h4 className="font-display text-lg font-semibold text-foreground">Inicie a conversa</h4><p className="text-sm text-muted-foreground">Envie a primeira mensagem do grupo!</p></div> : <div className="space-y-4">{messages.map(message => { const isOwn = message.sender_id === profile?.id; const sender = message.sender; const senderSector = sectors.find(s => s.id === sender?.sector_id); const senderName = sender?.display_name || sender?.name || 'Usuário'; return <div key={message.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}><Avatar className="h-8 w-8 flex-shrink-0"><AvatarImage src={sender?.avatar_url || ''} /><AvatarFallback className="text-xs text-white" style={{ backgroundColor: senderSector?.color || '#6366f1' }}>{getInitials(senderName)}</AvatarFallback></Avatar><div className={cn('flex flex-col', isOwn && 'items-end')}><div className={cn('mb-1 flex items-center gap-2', isOwn && 'flex-row-reverse')}><span className="text-xs font-medium text-foreground">{senderName}</span><span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span></div><div className={cn('rounded-[26px] px-4 py-2.5 shadow-sm max-w-[min(70vw,400px)] w-fit', isOwn ? 'gradient-primary text-white rounded-tr-md' : 'bg-card text-card-foreground rounded-tl-md border border-border')}>{renderMessageContent(message.content, isOwn)}{isOwn && <span className="ml-1 inline-flex items-center">{message.id.startsWith('temp-') ? <Check className="h-3.5 w-3.5 text-white/60" /> : <CheckCheck className="h-3.5 w-3.5 text-white/80" />}</span>}</div></div></div>; })}<div ref={scrollRef} /></div>}</ScrollArea></div>
    <TypingIndicator typingUsers={typingUsers} />{currentMember && <ChatInput onSendMessage={handleSendMessage} onTyping={sendTyping} onMention={handleMention} />}
    <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}><DialogContent><DialogHeader><DialogTitle>Adicionar Membro</DialogTitle><DialogDescription>Selecione um usuário para adicionar ao grupo</DialogDescription></DialogHeader><ScrollArea className="max-h-[400px]"><div className="space-y-2 p-1">{availableUsers.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">Todos os usuários já estão no grupo</p> : availableUsers.map(availableUser => { const sector = sectors.find(s => s.id === availableUser.sector_id); const displayName = availableUser.display_name || availableUser.name; const isLoading = addingMember === availableUser.id; const userId = (availableUser as any).user_id; return <button key={availableUser.id} onClick={() => handleAddMember(userId, availableUser.id)} disabled={!!addingMember} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted transition-colors disabled:opacity-50"><Avatar className="h-10 w-10"><AvatarImage src={availableUser.avatar_url || ''} /><AvatarFallback className="text-sm text-white" style={{ backgroundColor: sector?.color || '#6366f1' }}>{getInitials(displayName)}</AvatarFallback></Avatar><div className="flex-1"><span className="font-medium text-foreground">{displayName}</span><div className="flex items-center gap-2">{sector && <span className="text-xs text-muted-foreground">{sector.name}</span>}<span className={cn('text-xs', getStatusColor((availableUser as any).user_status))}>• {getStatusLabel((availableUser as any).user_status)}</span></div></div>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}</button>; })}</div></ScrollArea></DialogContent></Dialog>
    <Dialog open={showEditAvatarDialog} onOpenChange={setShowEditAvatarDialog}><DialogContent><DialogHeader><DialogTitle>Alterar Imagem do Grupo</DialogTitle><DialogDescription>Cole a URL de uma imagem para usar como capa do grupo</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="flex justify-center"><Avatar className="h-24 w-24"><AvatarImage src={avatarUrl} /><AvatarFallback className="bg-primary text-primary-foreground text-2xl">{getInitials(group.name)}</AvatarFallback></Avatar></div><div className="space-y-2"><Label>URL da Imagem</Label><Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://exemplo.com/imagem.jpg" /></div></div><DialogFooter><Button variant="outline" onClick={() => setShowEditAvatarDialog(false)}>Cancelar</Button><Button onClick={handleUpdateAvatar}>Salvar</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Grupo</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir o grupo "{group.name}"? Todas as mensagens e membros serão removidos permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup} disabled={deletingGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingGroup ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <ChatPersonalizationDialog open={showPersonalization} onOpenChange={setShowPersonalization} chatId={group.id ? `group-${group.id}` : null} chatName={group.name} />
    <UserPreviewDialog open={!!previewUserId} onOpenChange={open => !open && setPreviewUserId(null)} profileId={previewUserId || ''} userId="" />
  </div>;
}
