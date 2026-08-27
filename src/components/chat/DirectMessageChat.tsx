import React, { useEffect, useRef } from 'react';
import { MessageCircle, Check, CheckCheck, FolderOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatMediaFilter } from '@/components/chat/ChatMediaFilter';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useDirectMessages, useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useSound } from '@/hooks/useSound';
import { useAllUsersPresence } from '@/hooks/usePresence';
import { PresenceIndicator } from '@/components/user/PresenceIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { formatText } from '@/lib/chatFormatUtils';
import { cn } from '@/lib/utils';
import { SignedStorageImage, SignedStorageLink } from '@/components/common/SignedStorageMedia';

interface DirectMessageChatProps { partnerId: string | null; }

export function DirectMessageChat({ partnerId }: DirectMessageChatProps) {
  const { profile } = useAuth();
  const { messages, loading, sendMessage } = useDirectMessages(partnerId || undefined);
  const { users } = useActiveUsers();
  const { sectors } = useSectors();
  const { playMessageSent } = useSound();
  const { getUserPresence } = useAllUsersPresence();
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelId = partnerId && profile ? [profile.id, partnerId].sort().join('-') : '';
  const { typingUsers, sendTyping } = useTypingIndicator(`dm-${channelId}`);
  const partner = users.find(u => u.id === partnerId);
  const partnerSector = sectors.find(s => s.id === partner?.sector_id);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const renderMessageContent = (content: string, isOwn: boolean) => {
    const lines = content.split('\n');
    const textLines: string[] = [];
    const attachments: { type: 'image' | 'file'; name: string; url: string }[] = [];
    for (const line of lines) {
      const imageMatch = line.match(/^📷 \[(.+?)\]\((.+?)\)$/);
      const fileMatch = line.match(/^📎 \[(.+?)\]\((.+?)\)$/);
      if (imageMatch) attachments.push({ type: 'image', name: imageMatch[1], url: imageMatch[2] });
      else if (fileMatch) attachments.push({ type: 'file', name: fileMatch[1], url: fileMatch[2] });
      else textLines.push(line);
    }
    const textContent = textLines.join('\n').trim();
    return <div className="space-y-2">
      {textContent && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{textContent.split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{formatText(line, isOwn)}</React.Fragment>)}</p>}
      {attachments.map((att, i) => att.type === 'image' ? (
        <SignedStorageLink key={i} url={att.url}><SignedStorageImage url={att.url} alt={att.name} className="max-h-48 max-w-full rounded-2xl object-cover" /></SignedStorageLink>
      ) : (
        <SignedStorageLink key={i} url={att.url} className={cn('flex items-center gap-2 rounded-2xl p-2 text-xs', isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80')}><span>📎</span><span className="truncate">{att.name}</span></SignedStorageLink>
      ))}
    </div>;
  };

  const handleSendMessage = async (content: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[]) => {
    playMessageSent();
    let fullContent = content;
    if (attachments?.length) {
      fullContent += attachments.map(a => a.fileType.startsWith('image/') ? `\n📷 [${a.fileName}](${a.url})` : `\n📎 [${a.fileName}](${a.url})`).join('');
    }
    const { error } = await sendMessage(fullContent);
    if (error) console.error('Error sending message:', error);
  };

  if (!partnerId) return <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-8 text-center"><div className="mb-4 rounded-full bg-muted p-6"><MessageCircle className="h-12 w-12 text-muted-foreground" /></div><h3 className="font-display text-xl font-semibold text-foreground">Selecione uma conversa</h3><p className="mt-2 text-muted-foreground">Escolha um usuário para iniciar uma conversa</p></div>;

  const displayName = partner?.display_name || partner?.name || 'Usuário';
  const presence = partner ? getUserPresence(partner.user_id || partner.id) : null;
  const status = !partner ? 'Offline' : presence?.isOnline && presence.lastHeartbeat ? (Date.now() - presence.lastHeartbeat.getTime() < 120000 ? 'Online' : 'Inativo') : 'Offline';

  return <div className="flex h-full min-h-0 flex-col overflow-hidden">
    <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/65 px-3 py-2 backdrop-blur-2xl sm:px-4">
      <div className="relative shrink-0"><Avatar className="h-9 w-9 sm:h-10 sm:w-10"><AvatarImage src={partner?.avatar_url || ''} /><AvatarFallback className="text-xs text-white" style={{ backgroundColor: partnerSector?.color || '#6366f1' }}>{getInitials(displayName)}</AvatarFallback></Avatar>{partner && <PresenceIndicator isOnline={presence?.isOnline || false} lastHeartbeat={presence?.lastHeartbeat} />}</div>
      <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-foreground sm:text-[15px]">{displayName}</h3><p className="truncate text-[10px] text-muted-foreground sm:text-xs">{status}{partnerSector && ` • ${partnerSector.name}`}</p></div>
      <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" title="Mídia e arquivos" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-background/70 hover:text-foreground"><FolderOpen className="h-4 w-4 sm:h-5 sm:w-5" /></Button></SheetTrigger><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>Mídia e Arquivos</SheetTitle></SheetHeader><div className="mt-6"><ChatMediaFilter chatType="direct" chatId={partnerId} profileId={profile?.id} /></div></SheetContent></Sheet>
    </div>

    <ScrollArea className="min-h-0 flex-1 px-3 py-3 sm:p-4">
      {loading ? <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : messages.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 rounded-full bg-muted p-4"><span className="text-4xl">👋</span></div><h4 className="font-display text-lg font-semibold text-foreground">Inicie a conversa</h4><p className="text-sm text-muted-foreground">Envie uma mensagem para {displayName}</p></div> : <div className="space-y-4">
        {messages.map(message => {
          const isOwn = message.sender_id === profile?.id;
          const sender = isOwn ? profile : partner;
          const senderSector = sectors.find(s => s.id === sender?.sector_id);
          const senderName = sender?.display_name || sender?.name || 'Usuário';
          return <div key={message.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
            <Avatar className="h-8 w-8 shrink-0"><AvatarImage src={sender?.avatar_url || ''} /><AvatarFallback className="text-xs text-white" style={{ backgroundColor: senderSector?.color || '#6366f1' }}>{getInitials(senderName)}</AvatarFallback></Avatar>
            <div className={cn('flex min-w-0 flex-col', isOwn && 'items-end')}><div className={cn('mb-1 flex items-center gap-2', isOwn && 'flex-row-reverse')}><span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span></div><div className={cn('w-fit max-w-[min(78vw,400px)] rounded-[24px] px-4 py-2.5 shadow-sm', isOwn ? 'gradient-primary rounded-tr-md text-white' : 'rounded-tl-md border border-border bg-card text-card-foreground')}>{renderMessageContent(message.content, isOwn)}{isOwn && <span className="ml-1 inline-flex items-center">{message.id.startsWith('temp-') ? <Check className="h-3.5 w-3.5 text-white/60" /> : <CheckCheck className="h-3.5 w-3.5 text-white/80" />}</span>}</div></div>
          </div>;
        })}<div ref={scrollRef} /></div>}
    </ScrollArea>
    <div className="shrink-0"><TypingIndicator typingUsers={typingUsers} /></div>
    <ChatInput onSendMessage={handleSendMessage} onTyping={sendTyping} />
  </div>;
}
