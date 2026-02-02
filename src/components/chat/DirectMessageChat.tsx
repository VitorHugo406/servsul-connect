import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatInput } from '@/components/chat/ChatInput';
import { useDirectMessages, useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { useSound } from '@/hooks/useSound';
import { cn } from '@/lib/utils';

interface DirectMessageChatProps {
  partnerId: string | null;
}

export function DirectMessageChat({ partnerId }: DirectMessageChatProps) {
  const { profile } = useAuth();
  const { messages, loading, sendMessage } = useDirectMessages(partnerId || undefined);
  const { users } = useActiveUsers();
  const { sectors } = useSectors();
  const { playMessageSent } = useSound();
  const scrollRef = useRef<HTMLDivElement>(null);

  const partner = users.find(u => u.id === partnerId);
  const partnerSector = sectors.find(s => s.id === partner?.sector_id);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
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

  if (!partnerId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/20 p-8 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <MessageCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground">
          Selecione uma conversa
        </h3>
        <p className="mt-2 text-muted-foreground">
          Escolha um usuário para iniciar uma conversa
        </p>
      </div>
    );
  }

  const displayName = partner?.display_name || partner?.name || 'Usuário';

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={partner?.avatar_url || ''} />
            <AvatarFallback
              className="text-sm text-white"
              style={{ backgroundColor: partnerSector?.color || '#6366f1' }}
            >
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {partner?.is_active && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
          )}
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">{displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {partner?.is_active ? 'Online' : 'Offline'}
            {partnerSector && ` • ${partnerSector.name}`}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
              Envie uma mensagem para {displayName}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === profile?.id;
              const sender = isOwn ? profile : partner;
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
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
}