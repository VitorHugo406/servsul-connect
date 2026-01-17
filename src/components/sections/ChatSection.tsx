import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMessages, useSectors } from '@/hooks/useData';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { SectorTabs } from '@/components/chat/SectorTabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle } from 'lucide-react';

export function ChatSection() {
  const { profile, isAdmin, geralSectorId } = useAuth();
  const { sectors, loading: sectorsLoading } = useSectors();
  const [activeSector, setActiveSector] = useState<string | null>(null);

  // Filter sectors user can access: their sector + Geral (or all if admin)
  const accessibleSectors = isAdmin 
    ? sectors 
    : sectors.filter(s => s.id === profile?.sector_id || s.id === geralSectorId);

  // Set initial sector based on user's sector or first available
  const effectiveSector = activeSector || profile?.sector_id || geralSectorId;
  
  const { messages, loading: messagesLoading, sendMessage, canSendMessages } = useMessages(effectiveSector);

  const handleSendMessage = async (content: string) => {
    const { error } = await sendMessage(content);
    if (error) {
      console.error('Error sending message:', error);
    }
  };

  const currentSector = sectors.find((s) => s.id === effectiveSector);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col"
    >
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
    </motion.div>
  );
}
