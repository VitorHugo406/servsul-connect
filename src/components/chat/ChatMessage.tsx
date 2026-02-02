import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors } from '@/hooks/useData';

interface Author {
  id: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  sector_id: string | null;
}

interface Message {
  id: string;
  content: string;
  author_id: string;
  sector_id: string;
  created_at: string;
  author?: Author;
  status?: 'sending' | 'sent' | 'delivered';
}

interface ChatMessageProps {
  message: Message;
  index: number;
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const { profile } = useAuth();
  const { sectors } = useSectors();
  
  const isOwn = message.author_id === profile?.id;
  const author = message.author;
  const authorSector = sectors.find((s) => s.id === author?.sector_id);
  
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

  const displayName = author?.display_name || author?.name || 'Usuário';
  
  // Message status - if it has an ID, it's in the database (delivered)
  const messageStatus = message.status || (message.id ? 'delivered' : 'sending');

  const renderStatus = () => {
    if (!isOwn) return null;
    
    return (
      <span className="ml-1 inline-flex items-center">
        {messageStatus === 'sending' ? (
          <Check className="h-3.5 w-3.5 text-white/60" />
        ) : (
          <CheckCheck className="h-3.5 w-3.5 text-white/80" />
        )}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn('flex gap-3', isOwn && 'flex-row-reverse')}
    >
      <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-border">
        <AvatarImage src={author?.avatar_url || ''} alt={displayName} />
        <AvatarFallback 
          className="text-sm font-semibold text-white"
          style={{ backgroundColor: authorSector?.color || '#6366f1' }}
        >
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn('flex flex-col', isOwn && 'items-end')}>
        <div className={cn('mb-1 flex flex-wrap items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          {authorSector && (
            <span 
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${authorSector.color}20`, color: authorSector.color }}
            >
              {authorSector.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formatTime(message.created_at)}</span>
        </div>
        
        <div
          className={cn(
            'rounded-2xl px-4 py-3 shadow-sm max-w-[min(70vw,400px)] w-fit',
            isOwn
              ? 'gradient-primary text-white rounded-tr-md'
              : 'bg-card text-card-foreground rounded-tl-md border border-border'
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
            {renderStatus()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
