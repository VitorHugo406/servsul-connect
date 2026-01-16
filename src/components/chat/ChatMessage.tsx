import { motion } from 'framer-motion';
import { Message } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { currentUser } from '@/data/mockData';

interface ChatMessageProps {
  message: Message;
  index: number;
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const isOwn = message.sender.id === currentUser.id;
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className={cn('flex gap-3', isOwn && 'flex-row-reverse')}
    >
      <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-border">
        <AvatarImage src={message.sender.avatar} alt={message.sender.displayName} />
        <AvatarFallback 
          className="text-sm font-semibold"
          style={{ backgroundColor: message.sender.sector.color, color: 'white' }}
        >
          {getInitials(message.sender.displayName)}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn('max-w-[70%]', isOwn && 'items-end')}>
        <div className={cn('mb-1 flex items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-sm font-medium text-foreground">{message.sender.displayName}</span>
          <span 
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${message.sender.sector.color}20`, color: message.sender.sector.color }}
          >
            {message.sender.sector.name}
          </span>
          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
        </div>
        
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm',
            isOwn
              ? 'gradient-primary text-primary-foreground rounded-tr-md'
              : 'bg-card text-card-foreground rounded-tl-md border border-border'
          )}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    </motion.div>
  );
}
