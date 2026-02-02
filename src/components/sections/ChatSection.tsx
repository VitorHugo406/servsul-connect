import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMessages, useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { SectorTabs } from '@/components/chat/SectorTabs';
import { DirectMessageList } from '@/components/chat/DirectMessageList';
import { DirectMessageChat } from '@/components/chat/DirectMessageChat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, MessageSquare, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSound } from '@/hooks/useSound';

type ChatMode = 'sectors' | 'direct';

export function ChatSection() {
  const { profile, isAdmin, geralSectorId, allAccessibleSectorIds } = useAuth();
  const { sectors, loading: sectorsLoading } = useSectors();
  const { markDirectMessagesAsRead } = useNotifications();
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('sectors');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { playMessageSent } = useSound();

  // Filter sectors user can access using the new allAccessibleSectorIds
  const accessibleSectors = isAdmin 
    ? sectors 
    : sectors.filter(s => allAccessibleSectorIds.includes(s.id));

  // Set initial sector based on user's sector or first available
  const effectiveSector = activeSector || profile?.sector_id || geralSectorId;
  
  const { messages, loading: messagesLoading, sendMessage, canSendMessages } = useMessages(effectiveSector);

  const handleSendMessage = async (content: string) => {
    // Play sound immediately for instant feedback
    playMessageSent();
    
    const { error } = await sendMessage(content);
    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const currentSector = sectors.find((s) => s.id === effectiveSector);

  // Handle back button on mobile
  const handleBack = () => {
    setSelectedUserId(null);
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
          <span className={isMobile ? 'text-xs' : ''}>Chat por Setor</span>
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
          <span className={isMobile ? 'text-xs' : ''}>Mensagens Diretas</span>
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
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
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
                messages.map((message, index) => (
                  <ChatMessage key={message.id} message={message} index={index} />
                ))
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          {canSendMessages ? (
            <ChatInput onSendMessage={handleSendMessage} />
          ) : (
            <div className="border-t border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Você só pode enviar mensagens no seu próprio setor
            </div>
          )}
        </>
      ) : (
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
      )}
    </motion.div>
  );
}
