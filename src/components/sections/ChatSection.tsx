import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, AlertCircle, Users, MessageSquare, ArrowLeft, UsersRound } from 'lucide-react';
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
import { usePrivateGroups } from '@/hooks/usePrivateGroups';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/skeletons';
import { getChatBackgroundKey } from '@/components/chat/ChatPersonalizationDialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSound } from '@/hooks/useSound';
import { useConversations } from '@/hooks/useDirectMessages';
import { supabase } from '@/integrations/supabase/client';
import { useMessageReactions } from '@/hooks/useMessageReactions';

type ChatMode = 'sectors' | 'direct' | 'groups';

export function ChatSection({ globalSearch = '' }: { globalSearch?: string }) {
  const { profile, isAdmin, geralSectorId, allAccessibleSectorIds, user } = useAuth();
  const { sectors, loading: sectorsLoading } = useSectors();
  const { markDirectMessagesAsRead } = useNotifications();
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('sectors');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sectorBackground, setSectorBackground] = useState('');
  const isMobile = useIsMobile();
  const { playMessageSent } = useSound();
  const { groups, refetch: refetchGroups } = usePrivateGroups();
  const { conversations } = useConversations();
  const [unreadGroupCount, setUnreadGroupCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitializedScrollRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const mentionedUsersRef = useRef<{ id: string; name: string }[]>([]);

  const accessibleSectors = isAdmin
    ? sectors
    : sectors.filter((sector) => allAccessibleSectorIds?.includes(sector.id));
  const effectiveSector = activeSector || profile?.sector_id || geralSectorId || null;
  const { typingUsers, sendTyping } = useTypingIndicator(`sector-${effectiveSector || 'none'}`);
  const { messages, loading: messagesLoading, sendMessage, canSendMessages } = useMessages(effectiveSector);
  const { reactions, toggleReaction } = useMessageReactions(messages.map((message) => message.id));
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; author?: { name: string; display_name: string | null } | null } | null>(null);

  useEffect(() => {
    if (!effectiveSector) {
      setSectorBackground('');
      return;
    }
    const key = getChatBackgroundKey(`sector-${effectiveSector}`);
    try { setSectorBackground(localStorage.getItem(key) || ''); } catch { setSectorBackground(''); }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId?: string; background?: string }>).detail;
      if (detail?.chatId === `sector-${effectiveSector}`) setSectorBackground(detail.background || '');
    };
    window.addEventListener('nuvexa:chat-background-changed', handler);
    return () => window.removeEventListener('nuvexa:chat-background-changed', handler);
  }, [effectiveSector]);

  useEffect(() => {
    if (!user || !effectiveSector) return;
    void supabase.from('user_notifications').update({ is_read: true }).eq('user_id', user.id).eq('type', 'mention').eq('is_read', false);
  }, [user, effectiveSector, messages]);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    if (!messagesLoading && messages.length > 0 && !hasInitializedScrollRef.current) {
      hasInitializedScrollRef.current = true;
      requestAnimationFrame(() => scrollToBottom(false));
    }
  }, [messagesLoading, messages.length, scrollToBottom]);

  useEffect(() => {
    hasInitializedScrollRef.current = false;
    setShowScrollToBottom(false);
  }, [effectiveSector]);

  const unreadDmCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  useEffect(() => {
    if (!profile || !user) return;
    const fetchGroupUnread = async () => {
      if (chatMode === 'groups') { setUnreadGroupCount(0); return; }
      let total = 0;
      for (const group of groups) {
        const { data: readData } = await supabase.from('private_group_message_reads').select('last_read_at').eq('group_id', group.id).eq('user_id', user.id).maybeSingle();
        const lastReadAt = readData?.last_read_at || '1970-01-01T00:00:00Z';
        const { count } = await supabase.from('private_group_messages').select('*', { count: 'exact', head: true }).eq('group_id', group.id).gt('created_at', lastReadAt).neq('sender_id', profile.id);
        total += count || 0;
      }
      setUnreadGroupCount(total);
    };
    void fetchGroupUnread();
    const channel = supabase.channel('chat-section-group-unread').on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_messages' }, () => void fetchGroupUnread()).on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_message_reads' }, () => void fetchGroupUnread()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile, user, groups, chatMode]);

  const handleMention = useCallback((userId: string, userName: string) => { mentionedUsersRef.current.push({ id: userId, name: userName }); }, []);

  const sendMentionNotifications = useCallback(async (content: string) => {
    if (!profile || mentionedUsersRef.current.length === 0) return;
    const mentioned = [...mentionedUsersRef.current];
    mentionedUsersRef.current = [];
    for (const mentionedUser of mentioned) {
      if (!content.includes(`@${mentionedUser.name}`)) continue;
      const { data: mentionedProfile } = await supabase.from('profiles').select('user_id').eq('id', mentionedUser.id).single();
      if (!mentionedProfile) continue;
      await supabase.rpc('create_user_notification', { _target_user_id: mentionedProfile.user_id, _type: 'mention', _title: 'Você foi mencionado', _message: `${profile.display_name || profile.name} mencionou você no chat: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`, _reference_id: null });
    }
  }, [profile]);

  const handleSendMessage = async (content: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[], replyToId?: string) => {
    playMessageSent();
    let fullContent = content;
    if (attachments?.length) fullContent += attachments.map((attachment) => attachment.fileType.startsWith('image/') ? `\n📷 [${attachment.fileName}](${attachment.url})` : `\n📎 [${attachment.fileName}](${attachment.url})`).join('');
    const { error } = await sendMessage(fullContent, { reply_to_id: replyToId });
    if (error) { console.error('Error sending message:', error); return; }
    setReplyTo(null);
    await sendMentionNotifications(fullContent);
  };

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
  useEffect(() => {
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) void refetchGroups();
  }, [selectedGroupId, groups, refetchGroups]);

  const handleBack = () => { setSelectedUserId(null); setSelectedGroupId(null); };
  useEffect(() => {
    if (isMobile && chatMode === 'direct' && selectedUserId) void markDirectMessagesAsRead(selectedUserId);
  }, [isMobile, chatMode, selectedUserId, markDirectMessagesAsRead]);

  if (sectorsLoading) return <div className="flex h-full flex-col gap-4 p-4"><div className="glass-shimmer h-10 w-full rounded-xl" /><ListSkeleton rows={6} /></div>;
  if (!profile?.sector_id && !isAdmin && !geralSectorId) return <div className="flex h-full flex-col items-center justify-center p-8 text-center"><AlertCircle className="mb-4 h-12 w-12 text-warning" /><h3 className="font-display text-xl font-semibold text-foreground">Setor não definido</h3><p className="mt-2 text-muted-foreground">Você ainda não foi associado a um setor. Entre em contato com o administrador.</p></div>;

  if (isMobile && chatMode === 'direct' && selectedUserId) return <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex h-full flex-col"><div className="flex items-center gap-2 rounded-t-[26px] border-b border-border/40 bg-card/60 px-2 py-1.5 backdrop-blur-xl"><Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 shrink-0 rounded-full p-0"><ArrowLeft className="h-4 w-4" /></Button><div className="min-w-0 flex-1 overflow-hidden"><DirectMessageChat partnerId={selectedUserId} /></div></div></motion.div>;
  if (isMobile && chatMode === 'groups' && selectedGroupId) return <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex h-full flex-col"><div className="flex items-center gap-2 rounded-t-[26px] border-b border-border/40 bg-card/60 px-2 py-1.5 backdrop-blur-xl"><Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 shrink-0 rounded-full p-0"><ArrowLeft className="h-4 w-4" /></Button><div className="min-w-0 flex-1"><PrivateGroupChat group={selectedGroup} /></div></div></motion.div>;

  const currentSector = sectors.find((sector) => sector.id === effectiveSector);
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full min-h-0 flex-col">
    {!isMobile && <div className="flex shrink-0 border-b border-border bg-card">
      <button onClick={() => setChatMode('sectors')} className={cn('flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors', chatMode === 'sectors' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><Users className="h-4 w-4" /><span>Setores</span></button>
      <button onClick={() => setChatMode('direct')} className={cn('flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors', chatMode === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><MessageSquare className="h-4 w-4" /><span>Individual</span>{unreadDmCount > 0 && chatMode !== 'direct' && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}</button>
      <button onClick={() => setChatMode('groups')} className={cn('flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors', chatMode === 'groups' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><UsersRound className="h-4 w-4" /><span>Grupos</span>{unreadGroupCount > 0 && chatMode !== 'groups' && <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" />}</button>
    </div>}
    {isMobile && <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/65 px-3 py-2 backdrop-blur-2xl"><span className="text-sm font-semibold">{chatMode === 'sectors' ? (currentSector?.name || 'Setor') : chatMode === 'direct' ? 'Mensagens individuais' : 'Grupos'}</span></div>}
    {chatMode === 'sectors' && <div className="flex min-h-0 flex-1 flex-col">
      {!isMobile && <SectorTabs sectors={accessibleSectors} activeSector={effectiveSector || ''} onSectorChange={setActiveSector} />}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {sectorBackground && <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${sectorBackground})` }} />}
        <ScrollArea className="relative min-h-0 flex-1">
          <div className="flex flex-col px-3 py-4 md:px-6">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showDate = !previous || new Date(message.created_at).toDateString() !== new Date(previous.created_at).toDateString();
              return <div key={message.id}>{showDate && <DateSeparator date={message.created_at} />}<ChatMessage index={index} message={message} reactions={reactions[message.id] || []} onToggleReaction={toggleReaction} onReply={(selected) => setReplyTo({ id: selected.id, content: selected.content, author: selected.author })} /></div>;
            })}
            <div ref={messagesEndRef} className="h-px w-full" />
          </div>
        </ScrollArea>
        {showScrollToBottom && <Button onClick={() => scrollToBottom(true)} size="icon" className="absolute bottom-24 right-4 z-20 rounded-full shadow-lg"><ChevronDown className="h-5 w-5" /></Button>}
        <TypingIndicator users={typingUsers} />
        <ChatInput onSend={handleSendMessage} onTyping={sendTyping} onMention={handleMention} disabled={!canSendMessages} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      </div>
    </div>}
    {chatMode === 'direct' && <DirectMessageList search={globalSearch} onSelect={setSelectedUserId} />}
    {chatMode === 'groups' && <PrivateGroupList groups={groups} onSelect={setSelectedGroupId} />}
  </motion.div>;
}
