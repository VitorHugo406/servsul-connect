import { useState } from 'react';
import { motion } from 'framer-motion';
import { messages as initialMessages, currentUser, sectors } from '@/data/mockData';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { SectorTabs } from '@/components/chat/SectorTabs';
import { Message } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ChatSection() {
  const [activeSector, setActiveSector] = useState('5');
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: currentUser,
      sectorId: activeSector,
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);
  };

  const sectorMessages = messages.filter((m) => m.sectorId === activeSector);
  const currentSector = sectors.find((s) => s.id === activeSector);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col"
    >
      {/* Sector Tabs */}
      <SectorTabs activeSector={activeSector} onSectorChange={setActiveSector} />
      
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
            {sectorMessages.length} mensagens • {Math.floor(Math.random() * 5) + 2} online
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {sectorMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <span className="text-4xl">💬</span>
              </div>
              <h4 className="font-display text-lg font-semibold text-foreground">Nenhuma mensagem ainda</h4>
              <p className="text-sm text-muted-foreground">
                Seja o primeiro a enviar uma mensagem neste setor!
              </p>
            </div>
          ) : (
            sectorMessages.map((message, index) => (
              <ChatMessage key={message.id} message={message} index={index} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput onSendMessage={handleSendMessage} />
    </motion.div>
  );
}
