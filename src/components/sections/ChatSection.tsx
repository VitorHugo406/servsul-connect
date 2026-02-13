import { useState, useEffect, useRef } from 'react';
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
import { usePrivateGroups } from '@/hooks/usePrivateGroups';
import { SectorUsersList } from '@/components/sector/SectorUsersList';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, MessageSquare, ArrowLeft, UsersRound, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSound } from '@/hooks/useSound';
import { useConversations } from '@/hooks/useDirectMessages';
import { supabase } from '@/integrations/supabase/client';

type ChatMode = 'sectors' | 'direct' | 'groups';

export function ChatSection() {
  const { profile, isAdmin, geralSectorId, allAccessibleSectorIds, user } = useAuth();
  const { sectors, loading: sectorsLoading } = useSectors();
  const { markDirectMessagesAsRead } = useNotifications();
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('sectors');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showSectorUsers, setShowSectorUsers] = useState(false);
  const isMobile = useIsMobile();
  const { playMessageSent } = useSound();
  const { groups } = usePrivateGroups();
  const { conversations } = useConversations();
  const [unreadGroupCount, setUnreadGroupCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter sectors user can access using the new allAccessibleSectorIds
  const accessibleSectors = isAdmin 
    ? sectors 
    : sectors.filter(s => allAccessibleSectorIds.includes(s.id));

  // Set initial sector based on user's sector or first available
  const effectiveSector = activeSector || profile?.sector_id || geralSectorId;
  
  const { messages, loading: messagesLoading, sendMessage, canSendMessages } = useMessages(effectiveSector);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Calculate unread DM count
  const unreadDmCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Calculate unread group messages
  useEffect(() => {
    if (!profile || !user) return;

    const fetchGroupUnread = async () => {
      let total = 0;
      for (const group of groups) {
        // Get user's last read time for this group
        const { data: readData } = await supabase
          .from('private_group_message_reads')
          .select('last_read_at')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle();

        const lastReadAt = readData?.last_read_at || '1970-01-01T00:00:00Z';

        // Count messages after last read
        const { count } = await supabase
          .from('private_group_messages')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .gt('created_at', lastReadAt)
          .neq('sender_id', profile.id);

        total += count || 0;
      }
      setUnreadGroupCount(total);
    };

    fetchGroupUnread();

    // Subscribe to group messages
    const channel = supabase
      .channel('chat-section-group-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_messages' }, () => {
        fetchGroupUnread();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_group_message_reads' }, () => {
        fetchGroupUnread();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, user, groups]);

  const handleSendMessage = async (content: string, attachments?: { url: string; fileName: string; fileType: string; fileSize: number }[]) => {
    // Play sound immediately for instant feedback
    playMessageSent();
    
    // Build message content with attachments
    let fullContent = content;
    if (attachments && attachments.length > 0) {
      const attachmentLinks = attachments.map(a => {
        if (a.fileType.startsWith('image/')) {
          return `\n📷 [${a.fileName}](${a.url})`;
        }
        return `\n📎 [${a.fileName}](${a.url})`;
      }).join('');
      fullContent = content + attachmentLinks;
    }
    
    const { error } = await sendMessage(fullContent);
    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const currentSector = sectors.find((s) => s.id === effectiveSector);
  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  // Handle back button on mobile
  const handleBack = () => {
    setSelectedUserId(null);
    setSelectedGroupId(null);
  };

  // Mark messages as read when user is selected on mobile
  useEffect(() => {
    if (isMobile && chatMode === 'direct' && selectedUserId) {
      markDirectMessagesAsRead(selectedUserId);
    }
  }, [isMobile, chatMode, selectedUserId, markDirectMessagesAsRead]);

  if (sectorsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile?.sector_id && !isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-warning" />
        <h3 className="font-display text-xl font-semibold text-foreground">Setor não definido</h3>
        <p className="mt-2 text-muted-foreground">
          Você ainda não foi associado a um setor. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  // Mobile Direct Message - Show Chat (when user is selected)
  if (isMobile && chatMode === 'direct' && selectedUserId) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex h-full flex-col"
      >
        {/* Back button header */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-medium text-foreground">Voltar</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <DirectMessageChat partnerId={selectedUserId} />
        </div>
      </motion.div>
    );
  }

  // Mobile Group Chat
  if (isMobile && chatMode === 'groups' && selectedGroupId) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex h-full flex-col"
      >
        <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-2">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-medium text-foreground">Voltar</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PrivateGroupChat group={selectedGroup} />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col"
    >
      {/* Mode Toggle */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setChatMode('sectors')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            chatMode === 'sectors'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="h-4 w-4" />
          <span className={isMobile ? 'text-xs' : ''}>Setores</span>
        </button>
        <button
          onClick={() => setChatMode('direct')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            chatMode === 'direct'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          <span className={isMobile ? 'text-xs' : ''}>Individual</span>
          {unreadDmCount > 0 && chatMode !== 'direct' && (
            <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
          )}
        </button>
        <button
          onClick={() => setChatMode('groups')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            chatMode === 'groups'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UsersRound className="h-4 w-4" />
          <span className={isMobile ? 'text-xs' : ''}>Grupos</span>
          {unreadGroupCount > 0 && chatMode !== 'groups' && (
            <span className="h-2 w-2 rounded-full bg-orange-500 flex-shrink-0" />
          )}
        </button>
      </div>

      {chatMode === 'sectors' ? (
        <>
          {/* Sector Tabs */}
          <SectorTabs 
            sectors={accessibleSectors}
            activeSector={effectiveSector || ''} 
            onSectorChange={setActiveSector} 
          />
          
          {/* Chat Header */}
          <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: currentSector?.color }}
            >
              <span className="text-lg font-bold">{currentSector?.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">{currentSector?.name}</h3>
              <p className="text-xs text-muted-foreground">
                {messages.length} mensagens
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto"
              onClick={() => setShowSectorUsers(!showSectorUsers)}
              title={showSectorUsers ? 'Ocultar membros' : 'Ver membros do setor'}
            >
              {showSectorUsers ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>

          {/* Main Chat Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Messages */}
            <ScrollArea className={cn("flex-1 p-4", showSectorUsers && !isMobile && "border-r border-border")}>
              <div className="space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 rounded-full bg-muted p-4">
                      <span className="text-4xl">💬</span>
                    </div>
                    <h4 className="font-display text-lg font-semibold text-foreground">Nenhuma mensagem ainda</h4>
                    <p className="text-sm text-muted-foreground">
                      {canSendMessages 
                        ? 'Seja o primeiro a enviar uma mensagem neste setor!'
                        : 'Aguarde mensagens da sua equipe'}
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    // Show date separator when date changes
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const msgDate = new Date(message.created_at).toDateString();
                    const prevDate = prevMessage ? new Date(prevMessage.created_at).toDateString() : null;
                    const showDateSeparator = msgDate !== prevDate;

                    return (
                      <div key={message.id}>
                        {showDateSeparator && <DateSeparator date={message.created_at} />}
                        <ChatMessage message={message} index={index} />
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Sector Users Panel */}
            {showSectorUsers && !isMobile && (
              <div className="w-72 flex-shrink-0">
                <SectorUsersList sectorId={effectiveSector || ''} inline />
              </div>
            )}
          </div>

          {/* Mobile Sector Users Modal */}
          {showSectorUsers && isMobile && (
            <div className="absolute inset-0 z-50 bg-background">
              <div className="flex items-center justify-between border-b border-border p-3">
                <h3 className="font-semibold">Membros do Setor</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowSectorUsers(false)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
            <SectorUsersList sectorId={effectiveSector || ''} inline />
            </div>
          )}

          {/* Input */}
          {canSendMessages ? (
            <ChatInput onSendMessage={handleSendMessage} />
          ) : (
            <div className="border-t border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Você só pode enviar mensagens no seu próprio setor
            </div>
          )}
        </>
      ) : chatMode === 'direct' ? (
        // Direct Messages Mode
        isMobile ? (
          // Mobile: Show only the list (chat is shown separately when user selected)
          <div className="flex-1 overflow-hidden">
            <DirectMessageList
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
            />
          </div>
        ) : (
          // Desktop: Side by side layout
          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 flex-shrink-0">
              <DirectMessageList
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
              />
            </div>
            <div className="flex-1">
              <DirectMessageChat partnerId={selectedUserId} />
            </div>
          </div>
        )
      ) : (
        // Private Groups Mode
        isMobile ? (
          <div className="flex-1 overflow-hidden">
            <PrivateGroupList selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 flex-shrink-0">
              <PrivateGroupList selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} />
            </div>
            <div className="flex-1">
              <PrivateGroupChat group={selectedGroup} />
            </div>
          </div>
        )
      )}
    </motion.div>
  );
}
