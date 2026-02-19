import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors } from '@/hooks/useData';
import { CardMentionCard } from './CardMentionCard';

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

export function ChatMessage({ message }: ChatMessageProps) {
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

  // Format inline text: *bold*, _italic_, ~strikethrough~, [link](url)
  const formatText = (text: string, isOwnMsg: boolean): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*[^*]+\*|_[^_]+_|~[^~]+~|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const m = match[0];
      if (m.startsWith('*') && m.endsWith('*')) {
        parts.push(<strong key={key++}>{m.slice(1, -1)}</strong>);
      } else if (m.startsWith('_') && m.endsWith('_')) {
        parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
      } else if (m.startsWith('~') && m.endsWith('~')) {
        parts.push(<s key={key++}>{m.slice(1, -1)}</s>);
      } else if (m.startsWith('[')) {
        const linkMatch = m.match(/^\[(.+?)\]\((.+?)\)$/);
        if (linkMatch) {
          parts.push(
            <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
              className={cn("underline", isOwnMsg ? "text-white/90 hover:text-white" : "text-primary hover:text-primary/80")}
            >{linkMatch[1]}</a>
          );
        }
      }
      lastIndex = match.index + m.length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
  };

  // Parse card mention block
  const parseCardMention = (lines: string[]): { taskNumber: number; title: string; description?: string; labels?: string; priority: string; dueDate?: string; boardName: string } | null => {
    if (lines.length < 2) return null;
    const firstLine = lines[0];
    const match = firstLine.match(/^📋 Card #(\d+) — (.+)$/);
    if (!match) return null;
    
    let description: string | undefined;
    let labels: string | undefined;
    let priority = 'medium';
    let dueDate: string | undefined;
    let boardName = '';
    
    for (const line of lines.slice(1)) {
      if (line.startsWith('📝 ')) description = line.slice(3);
      else if (line.startsWith('🏷️ ')) labels = line.slice(3);
      else if (line.startsWith('⚡ Prioridade: ')) {
        const pLabel = line.replace('⚡ Prioridade: ', '');
        if (pLabel === 'Baixa') priority = 'low';
        else if (pLabel === 'Média') priority = 'medium';
        else if (pLabel === 'Alta') priority = 'high';
        else if (pLabel === 'Urgente') priority = 'urgent';
      }
      else if (line.startsWith('📅 Prazo: ')) dueDate = line.replace('📅 Prazo: ', '');
      else if (line.startsWith('📌 Mural: ')) boardName = line.replace('📌 Mural: ', '');
    }
    
    return { taskNumber: parseInt(match[1]), title: match[2], description, labels, priority, dueDate, boardName };
  };

  // Parse content for attachment links and card mentions
  const renderContent = (content: string, isOwnMsg: boolean) => {
    const lines = content.split('\n');
    const textLines: string[] = [];
    const attachments: { type: 'image' | 'file'; name: string; url: string }[] = [];
    const elements: React.ReactNode[] = [];
    let cardMentionLines: string[] = [];
    let inCardMention = false;

    const flushCardMention = () => {
      if (cardMentionLines.length > 0) {
        const card = parseCardMention(cardMentionLines);
        if (card) {
          elements.push(
            <CardMentionCard key={`card-${card.taskNumber}`} {...card} isOwnMessage={isOwnMsg} />
          );
        } else {
          // Not a valid card mention, treat as text
          textLines.push(...cardMentionLines);
        }
        cardMentionLines = [];
        inCardMention = false;
      }
    };

    for (const line of lines) {
      if (line.startsWith('📋 Card #')) {
        flushCardMention();
        inCardMention = true;
        cardMentionLines.push(line);
      } else if (inCardMention && (line.startsWith('📝 ') || line.startsWith('🏷️ ') || line.startsWith('⚡ ') || line.startsWith('📅 ') || line.startsWith('📌 '))) {
        cardMentionLines.push(line);
      } else {
        flushCardMention();
        const imageMatch = line.match(/^📷 \[(.+?)\]\((.+?)\)$/);
        const fileMatch = line.match(/^📎 \[(.+?)\]\((.+?)\)$/);
        if (imageMatch) {
          attachments.push({ type: 'image', name: imageMatch[1], url: imageMatch[2] });
        } else if (fileMatch) {
          attachments.push({ type: 'file', name: fileMatch[1], url: fileMatch[2] });
        } else {
          textLines.push(line);
        }
      }
    }
    flushCardMention();

    const textContent = textLines.join('\n').trim();

    return (
      <div className="space-y-2">
        {textContent && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {textContent.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {formatText(line, isOwnMsg)}
              </React.Fragment>
            ))}
          </p>
        )}
        {elements}
        {attachments.map((att, i) => (
          att.type === 'image' ? (
            <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
              <img src={att.url} alt={att.name} className="max-w-full max-h-48 rounded-lg object-cover" />
            </a>
          ) : (
            <a
              key={i}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 text-xs",
                isOwn ? "bg-white/10 hover:bg-white/20" : "bg-muted hover:bg-muted/80"
              )}
            >
              <span>📎</span>
              <span className="truncate">{att.name}</span>
            </a>
          )
        ))}
      </div>
    );
  };

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
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
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
          {renderContent(message.content, isOwn)}
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}

// Date separator component
export function DateSeparator({ date }: { date: string }) {
  const getLabel = (dateStr: string) => {
    const msgDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(msgDate, today)) return 'Hoje';
    if (isSameDay(msgDate, yesterday)) return 'Ontem';
    return msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="flex items-center justify-center my-4">
      <span className="rounded-lg bg-muted px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
        {getLabel(date)}
      </span>
    </div>
  );
}
