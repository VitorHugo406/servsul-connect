import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMessages, useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { ChatMessage, DateSeparator } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { SectorTabs } from '@/components/chat/SectorTabs';
import { DirectMessageList } from '@/components/chat/DirectMessageList';
import { DirectMessageChat } from '@/components/chat/DirectMessageChat';
import { PrivateGroupList } from '@/components/chat/PrivateGroupList';
import { PrivateGroupChat } from '@/components/chat/PrivateGroupChat';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ScheduledSummaryConfig } from '@/components/chat/ScheduledSummaryConfig';
import { usePrivateGroups } from '@/hooks/usePrivateGroups';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { SectorUsersList } from '@/components/sector/SectorUsersList';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertCircle, Users, MessageSquare, ArrowLeft, UsersRound, Eye, EyeOff, Search, Calendar as CalendarIcon, Bot, FolderOpen } from 'lucide-react';
import { ListSkeleton } from '@/components/ui/skeletons';
import { ChatMediaFilter } from '@/components/chat/ChatMediaFilter';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSound } from '@/hooks/useSound';
import { useConversations } from '@/hooks/useDirectMessages';
import { supabase } from '@/integrations/supabase/client';
import { useMessageReactions } from '@/hooks/useMessageReactions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type ChatMode = 'sectors' | 'direct' | 'groups';

export function ChatSection({ globalSearch = '' }: { globalSearch?: string }) {
  const { profile, isAdmin, geralSectorId, allAccessibleSectorIds, user } = useAuth();
  const { sectors, loading: sectorsLoading } = useSectors();
  const { markDirectMessagesAsRead } = useNotifications();
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('sectors');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showSectorUsers, setShowSectorUsers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState<string | null>(null);
  const [showMobileAutomation, setShowMobileAutomation] = useState(false);
  const [showMobileMedia, setShowMobileMedia] = useState(false);

  const isMobile = useIsMobile();
  const { playMessageSent } = useSound();
  const { groups, refetch: refetchGroups } = usePrivateGroups();
  const { conversations } = useConversations();
  const [unreadGroupCount, setUnreadGroupCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const mentionedUsersRef = useRef<{id: string; name: string}[]>([]);

  const accessibleSectors = isAdmin ? sectors : sectors.filter(s => allAccessibleSectorIds.includes(s.id));
  const effectiveSector = activeSector || profile?.sector_id || geralSectorId;
  const { typingUsers, sendTyping } = useTypingIndicator(`sector-${effectiveSector || 'none'}`);
  const { messages, loading: messagesLoading, sendMessage, canSendMessages } = useMessages(effectiveSector);
  const { reactions, toggleReaction } = useMessageReactions(messages.map(m => m.id));
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; author?: { name: string; display_name: string | null } | null } | null>(null);

  useEffect(() => {
    if (!user || !effectiveSector) return;
    const markMentionsRead = async () => {
      try {
        await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', user.id).eq('type', 'mention').eq('is_read', false);
      } catch (e) {
        // silently ignore
      }
    };
    markMentionsRead();
  }, [user, effectiveSector, messages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const unreadDmCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  useEffect(() => {
    if (!profile || !user) return;
    const fetchGroupUnread = async () => {
      if (chatMode === 'groups') {
        setUnreadGroupCount(0);
        return;
      }
      let total = 0;
      for (const group of groups) {
        const { data: readData } = await supabase.from('private_group_message_reads').select('last_read_at').eq('group_id', group.id).eq('user_id', user.id).maybeSingle();
        const lastReadAt = readData?.last_read_at || '1970-01-01T00:00:00Z';
        const { count } = await supabase.from('private_group_messages').select('*', { count: 'exact', head: true }).eq('group_id', group.id).gt('created_at', lastReadAt).neq('sender_id', profile.id);
        total += count || 0;
      }
      setUnreadGroupCount(total);
    };
    fetchGroupUnread();
    const channel = supabase.channel('chat-section-group-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_messages' }, () => fetchGroupUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_message_reads' }, () => fetchGroupUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, user, groups, chatMode]);

  const handleMention = useCallback((userId: string, userName: string) => {
    mentionedUsersRef.current.push({ id: userId, name: userName });
  }, []);

  const sendMentionNotifications = useCallback(async (content: string) => {
    if (!profile || mentionedUsersRef.current.length === 0) return;
    const mentioned = [...mentionedUsersRef.current];
    mentionedUsersRef.current = [];
    for (const mentionedUser of mentioned) {
      if (!content.includes(`@${mentionedUser.name}`)) continue;
      const { data: mentionedProfile } = await supabase.from('profiles').select('user_id').eq('id', mentionedUser.id).single();
      if (!mentionedProfile) continue;
      await supabase.rpc('create_user_notification', {
        _target_user_id: mentionedProfile.user_id,
        _type: 'mention',
        _title: 'Você foi mencionado',
        _message: `${profile.display_name || profile.name} mencionou você no chat: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
        _reference_id: null,
      });
    }
  }, [profile]);

  const handleSendMessage = async (content: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[], replyToId?: string) => {
    playMessageSent();
    let fullContent = content;
    if (attachments && attachments.length > 0) {
      const attachmentLinks = attachments.map(a => a.fileType.startsWith('image/') ? `\n📷 [${a.fileName}](${a.url})` : `\n📎 [${a.fileName}](${a.url})`).join('');
      fullContent = content + attachmentLinks;
    }
    const { error } = await sendMessage(fullContent, { reply_to_id: replyToId });
    if (error) console.error('Error sending message:', error);
    else {
      setReplyTo(null);
      await sendMentionNotifications(fullContent);
    }
  };

  const currentSector = sectors.find((s) => s.id === effectiveSector);
  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  useEffect(() => {
    if (selectedGroupId && !groups.find(g => g.id === selectedGroupId)) refetchGroups();
  }, [selectedGroupId, groups, refetchGroups]);

  const handleBack = () => {
    setSelectedUserId(null);
    setSelectedGroupId(null);
  };

  useEffect(() => {
    if (isMobile && chatMode === 'direct' && selectedUserId) markDirectMessagesAsRead(selectedUserId);
  }, [isMobile, chatMode, selectedUserId, markDirectMessagesAsRead]);

  if (sectorsLoading) {
    return <div className="flex h-full flex-col p-4 gap-4"><div className="glass-shimmer h-10 w-full rounded-xl" /><ListSkeleton rows={6} /></div>;
  }

  if (!profile?.sector_id && !isAdmin) {
    return <div className="flex h-full flex-col items-center justify-center p-8 text-center"><AlertCircle className="mb-4 h-12 w-12 text-warning" /><h3 className="font-display text-xl font-semibold text-foreground">Setor não definido</h3><p className="mt-2 text-muted-foreground">Você ainda não foi associado a um setor. Entre em contato com o administrador.</p></div>;
  }

  if (isMobile && chatMode === 'direct' && selectedUserId) {
    return <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex h-full flex-col"><div className="flex items-center gap-2 rounded-t-[26px] border-b border-border/40 bg-card/60 px-3 py-2 backdrop-blur-xl"><Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10"><ArrowLeft className="h-5 w-5" /></Button><span className="font-medium text-foreground">Voltar</span></div><div className="flex-1 overflow-hidden"><DirectMessageChat partnerId={selectedUserId} /></div></motion.div>;
  }

  if (isMobile && chatMode === 'groups' && selectedGroupId) {
    return <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex h-full flex-col"><div className="flex items-center gap-2 rounded-t-[26px] border-b border-border/40 bg-card/60 px-3 py-2 backdrop-blur-xl"><Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10"><ArrowLeft className="h-5 w-5" /></Button><span className="font-medium text-foreground">Voltar</span></div><div className="flex-1 overflow-hidden"><PrivateGroupChat group={selectedGroup} /></div></motion.div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col">
      {!isMobile && <div className="flex border-b border-border bg-card shrink-0">
        <button onClick={() => setChatMode('sectors')} className={cn('flex flex-1 items-center justify-center gap-2 font-medium transition-colors','px-4 py-3 text-sm',chatMode === 'sectors' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><Users className="h-4 w-4" /><span>Setores</span></button>
        <button onClick={() => setChatMode('direct')} className={cn('flex flex-1 items-center justify-center gap-2 font-medium transition-colors','px-4 py-3 text-sm',chatMode === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><MessageSquare className="h-4 w-4" /><span>Individual</span>{unreadDmCount > 0 && chatMode !== 'direct' && <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />}</button>
        <button onClick={() => setChatMode('groups')} className={cn('flex flex-1 items-center justify-center gap-2 font-medium transition-colors','px-4 py-3 text-sm',chatMode === 'groups' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><UsersRound className="h-4 w-4" /><span>Grupos</span>{unreadGroupCount > 0 && chatMode !== 'groups' && <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />}</button>
      </div>}

      {isMobile && (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/65 px-3 py-2 backdrop-blur-2xl">
            {chatMode === 'sectors' && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-10 min-w-0 flex-1 justify-start gap-2 rounded-full border border-border/60 bg-background/65 px-3 shadow-sm" aria-label="Selecionar setor"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground" style={{ backgroundColor: currentSector?.color }}>{currentSector?.name?.charAt(0)}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold text-foreground">{currentSector?.name || 'Setor'}</span><span className="block truncate text-[10px] text-muted-foreground">Canais da empresa</span></span><ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="max-h-[60vh] w-[min(88vw,320px)] overflow-y-auto rounded-2xl border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-2xl"><DropdownMenuLabel>Canais da empresa</DropdownMenuLabel>{accessibleSectors.map((s: any) => <DropdownMenuItem key={s.id} className="rounded-xl py-2.5" onSelect={() => setActiveSector(s.id)}><span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground" style={{ backgroundColor: s.color }}>{s.name.charAt(0)}</span><span className="truncate">{s.name}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
            {chatMode === 'direct' && <div className="min-w-0 flex-1 px-1"><p className="truncate text-sm font-semibold text-foreground">Mensagens individuais</p><p className="truncate text-[10px] text-muted-foreground">Conversas privadas</p></div>}
            {chatMode === 'groups' && <div className="min-w-0 flex-1 px-1"><p className="truncate text-sm font-semibold text-foreground">Grupos</p><p className="truncate text-[10px] text-muted-foreground">Grupos privados</p></div>}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full border border-border/60 bg-background/65 shadow-sm" aria-label="Opções da conversa"><Settings className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-2xl"><DropdownMenuLabel>Opções da conversa</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuLabel className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de conversa</DropdownMenuLabel><DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setChatMode('direct')}><MessageSquare className="mr-2 h-4 w-4" /> Individuais</DropdownMenuItem><DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setChatMode('groups')}><UsersRound className="mr-2 h-4 w-4" /> Grupos</DropdownMenuItem><DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setChatMode('sectors')}><Users className="mr-2 h-4 w-4" /> Canais da empresa</DropdownMenuItem>{chatMode === 'sectors' && <><DropdownMenuSeparator /><DropdownMenuLabel className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Ferramentas do canal</DropdownMenuLabel><DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setShowSectorUsers(true)}>{showSectorUsers ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />} Usuários do canal</DropdownMenuItem><DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setShowSearch(true)}><Search className="mr-2 h-4 w-4" /> Pesquisar mensagens</DropdownMenuItem>{effectiveSector && effectiveSector !== geralSectorId && <DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setShowMobileMedia(true)}><FolderOpen className="mr-2 h-4 w-4" /> Mídia e arquivos</DropdownMenuItem>}{isAdmin && effectiveSector && effectiveSector !== geralSectorId && <DropdownMenuItem className="rounded-xl py-2.5" onSelect={() => setShowMobileAutomation(true)}><Bot className="mr-2 h-4 w-4" /> Automações de resumo</DropdownMenuItem>}</>}</DropdownMenuContent></DropdownMenu>
          </div>
          <Sheet open={showMobileAutomation} onOpenChange={setShowMobileAutomation}><SheetContent><SheetHeader><SheetTitle>Automações - {currentSector?.name}</SheetTitle></SheetHeader>{effectiveSector && <div className="mt-6"><ScheduledSummaryConfig targetType="sector" targetId={effectiveSector} targetName={currentSector?.name || 'Setor'} /></div>}</SheetContent></Sheet>
          <Sheet open={showMobileMedia} onOpenChange={setShowMobileMedia}><SheetContent><SheetHeader><SheetTitle>Mídia e Arquivos - {currentSector?.name}</SheetTitle></SheetHeader>{effectiveSector && <div className="mt-6"><ChatMediaFilter chatType="sector" chatId={effectiveSector} /></div>}</SheetContent></Sheet>
        </>
      )}

      {chatMode === 'sectors' ? (
        <>
          {!isMobile && <SectorTabs sectors={accessibleSectors} activeSector={effectiveSector || ''} onSectorChange={setActiveSector} />}
          <div className={cn('flex items-center gap-3 border-b border-border bg-card shrink-0', isMobile ? 'hidden' : 'px-4 py-3')}>
            <div className="flex items-center justify-center rounded-xl text-white shrink-0 h-10 w-10" style={{ backgroundColor: currentSector?.color }}><span className="font-bold text-lg">{currentSector?.name.charAt(0)}</span></div>
            <div className="flex-1 min-w-0"><h3 className="font-display font-semibold text-foreground truncate">{currentSector?.name}</h3><p className="text-xs text-muted-foreground">{messages.length} mensagens</p></div>
            <div className="flex items-center gap-1 ml-auto">
              {isAdmin && effectiveSector && effectiveSector !== geralSectorId && <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" title="Automações de resumo"><Bot className="h-5 w-5" /></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Automações - {currentSector?.name}</SheetTitle></SheetHeader><div className="mt-6"><ScheduledSummaryConfig targetType="sector" targetId={effectiveSector} targetName={currentSector?.name || 'Setor'} /></div></SheetContent></Sheet>}
              {effectiveSector && effectiveSector !== geralSectorId && <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" title="Mídia e arquivos"><FolderOpen className="h-5 w-5" /></Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>Mídia e Arquivos - {currentSector?.name}</SheetTitle></SheetHeader><div className="mt-6"><ChatMediaFilter chatType="sector" chatId={effectiveSector} /></div></SheetContent></Sheet>}
              <Button variant="ghost" size="icon" onClick={() => setShowSectorUsers(!showSectorUsers)} title={showSectorUsers ? 'Ocultar membros' : 'Ver membros do setor'}>{showSectorUsers ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</Button>
              <Button variant="ghost" size="icon" onClick={() => { setShowSearch(!showSearch); if (showSearch) { setMessageSearchQuery(''); setSearchDate(null); } }} title="Buscar mensagens"><Search className="h-5 w-5" /></Button>
            </div>
          </div>

          {showSearch && <div className="border-b border-border bg-card px-4 py-2"><div className="flex items-center gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar por mensagem..." value={messageSearchQuery} onChange={(e) => setMessageSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" autoFocus /></div><div className="flex items-center gap-1 flex-shrink-0"><CalendarIcon className="h-4 w-4 text-muted-foreground" /><Input type="date" value={searchDate || ''} onChange={(e) => setSearchDate(e.target.value || null)} className="w-[140px] h-9 text-xs" /></div>{(messageSearchQuery || searchDate) && <Button variant="ghost" size="sm" className="h-9 px-2 text-xs flex-shrink-0" onClick={() => { setMessageSearchQuery(''); setSearchDate(null); }}>Limpar</Button>}</div></div>}

          <div className="flex flex-1 overflow-hidden">
            <ScrollArea className={cn("flex-1 p-4", showSectorUsers && !isMobile && "border-r border-border")} onScrollCapture={(e) => { const target = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]'); if (target) { const { scrollTop, scrollHeight, clientHeight } = target as HTMLElement; setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 200); } }}>
              <div className="space-y-4">
                {messagesLoading ? <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : messages.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><div className="mb-4 rounded-full bg-muted p-4"><span className="text-4xl">💬</span></div><h4 className="font-display text-lg font-semibold text-foreground">Nenhuma mensagem ainda</h4><p className="text-sm text-muted-foreground">{canSendMessages ? 'Seja o primeiro a enviar uma mensagem neste setor!' : 'Aguarde mensagens da sua equipe'}</p></div> : messages.filter(m => {
                  if (messageSearchQuery) { const q = messageSearchQuery.toLowerCase(); const matchText = m.content.toLowerCase().includes(q) || (m.author?.name || '').toLowerCase().includes(q) || (m.author?.display_name || '').toLowerCase().includes(q); if (!matchText) return false; }
                  if (searchDate) { const msgDate = new Date(m.created_at); const filterDate = new Date(searchDate + 'T00:00:00'); const msgDateStr = `${msgDate.getFullYear()}-${String(msgDate.getMonth() + 1).padStart(2, '0')}-${String(msgDate.getDate()).padStart(2, '0')}`; const filterDateStr = `${filterDate.getFullYear()}-${String(filterDate.getMonth() + 1).padStart(2, '0')}-${String(filterDate.getDate()).padStart(2, '0')}`; if (msgDateStr !== filterDateStr) return false; }
                  return true;
                }).map((message, index, filteredArr) => {
                  const prevMessage = index > 0 ? filteredArr[index - 1] : null;
                  const msgDate = new Date(message.created_at).toDateString();
                  const prevDate = prevMessage ? new Date(prevMessage.created_at).toDateString() : null;
                  const showDateSeparator = msgDate !== prevDate;
                  return <div key={message.id} id={`msg-${message.id}`} className="transition-colors duration-500 rounded-lg">{showDateSeparator && <DateSeparator date={message.created_at} />}<ChatMessage message={message} index={index} onReply={(msg) => setReplyTo({ id: msg.id, content: msg.content, author: msg.author })} reactions={reactions[message.id]} onToggleReaction={toggleReaction} onScrollToMessage={(id) => { const el = document.getElementById(`msg-${id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('bg-primary/10'); setTimeout(() => el.classList.remove('bg-primary/10'), 2000); } }} /></div>;
                })}
                <div ref={messagesEndRef} />
              </div>
              {showScrollToBottom && <button onClick={scrollToBottom} className="fixed bottom-32 right-8 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all" title="Ir para o final"><ChevronDown className="h-5 w-5" /></button>}
            </ScrollArea>
            {showSectorUsers && !isMobile && <div className="w-72 flex-shrink-0"><SectorUsersList sectorId={effectiveSector || ''} inline /></div>}
          </div>

          {showSectorUsers && isMobile && <div className="absolute inset-0 z-50 bg-background"><div className="flex items-center justify-between border-b border-border p-3"><h3 className="font-semibold">Membros do Setor</h3><Button variant="ghost" size="icon" onClick={() => setShowSectorUsers(false)}><ArrowLeft className="h-5 w-5" /></Button></div><SectorUsersList sectorId={effectiveSector || ''} inline /></div>}
          <TypingIndicator typingUsers={typingUsers} />
          {canSendMessages ? <ChatInput onSendMessage={handleSendMessage} onTyping={sendTyping} onMention={handleMention} replyTo={replyTo} onClearReply={() => setReplyTo(null)} /> : <div className="border-t border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">Você só pode enviar mensagens no seu próprio setor</div>}
        </>
      ) : chatMode === 'direct' ? (
        isMobile ? <div className="flex-1 overflow-hidden"><DirectMessageList selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} /></div> : <div className="flex flex-1 overflow-hidden"><div className="w-80 flex-shrink-0"><DirectMessageList selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} /></div><div className="flex-1"><DirectMessageChat partnerId={selectedUserId} /></div></div>
      ) : (
        isMobile ? <div className="flex-1 overflow-hidden"><PrivateGroupList selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} /></div> : <div className="flex flex-1 overflow-hidden"><div className="w-80 flex-shrink-0"><PrivateGroupList selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} /></div><div className="flex-1"><PrivateGroupChat group={selectedGroup} /></div></div>
      )}
    </motion.div>
  );
}
