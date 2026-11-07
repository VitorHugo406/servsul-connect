import { StickerView } from '@/components/common/Stickers';
import { parseSticker } from '@/lib/stickers';
import React, { useEffect, useRef, useState, memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, CheckCheck, Reply, SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CardMentionCard } from './CardMentionCard';
import { formatText } from '@/lib/chatFormatUtils';
import { ChatSenderAvatar } from './ChatSenderIdentity';
import { SignedStorageImage, SignedStorageLink } from '@/components/common/SignedStorageMedia';
import { Button } from '@/components/ui/button';
import { ChatEmojiGrid } from './ChatEmojiGrid';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🚀', '😍', '🥰', '😘', '🤩', '😎', '🤔', '🙌', '💯', '🎉', '🥳', '🤣', '😅', '😡', '😱', '😭', '🙏', '🤝', '👀', '💪', '✨', '❤️‍🔥', '💙', '💚', '💛', '💜', '🫶', '😴', '🤗', '😏', '🤯', '🥹', '😇', '🤪', '😈', '🤍', '🖤', '💔', '👏🏻', '👍🏻'];

interface Author { id: string; name: string; display_name: string | null; avatar_url: string | null; sector_id: string | null; sector_name?: string | null; sector_color?: string | null; }
interface ReplyAuthor { name: string; display_name: string | null; }
interface Message {
  id: string; content: string; author_id: string; sector_id: string; created_at: string;
  reply_to_id?: string | null;
  reply_to?: { id: string; content: string; reply_author?: ReplyAuthor | null } | null;
  author?: Author; status?: 'sending' | 'sent' | 'delivered';
}
interface Reaction {
  emoji: string; count: number; reactedByMe: boolean;
  reactors?: { id: string; name: string; display_name: string | null; avatar_url: string | null }[];
}
interface ChatMessageProps {
  message: Message; index: number; onReply?: (message: Message) => void;
  reactions?: Reaction[]; onToggleReaction?: (messageId: string, emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
}

function ChatMessageBase({ message, onReply, reactions, onToggleReaction, onScrollToMessage }: ChatMessageProps) {
  const { profile, sector } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipingRef = useRef(false);

  useEffect(() => {
    if (isFocused) document.body.classList.add('mobile-chat-focus-active');
    else document.body.classList.remove('mobile-chat-focus-active');
    return () => document.body.classList.remove('mobile-chat-focus-active');
  }, [isFocused]);

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const startLongPress = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? 0;
    touchStartY.current = event.touches[0]?.clientY ?? 0;
    swipingRef.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      setIsFocused(true);
      setShowReactionPicker(false);
    }, 500);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (isFocused) {
      event.preventDefault();
      return;
    }

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();
    if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
      swipingRef.current = true;
      setSwipeX(Math.min(dx, 84));
      event.preventDefault();
    }
  };

  const finishTouch = () => {
    cancelLongPress();
    if (swipingRef.current && swipeX >= 52) onReply?.(message);
    swipingRef.current = false;
    setSwipeX(0);
  };

  const closeFocus = () => {
    cancelLongPress();
    setIsFocused(false);
    setShowReactionPicker(false);
    swipingRef.current = false;
    setSwipeX(0);
  };

  const selectReaction = (emoji: string) => {
    onToggleReaction?.(message.id, emoji);
    closeFocus();
  };

  const isOwn = message.author_id === profile?.id;
  const author = isOwn ? { ...message.author, ...profile } : message.author;
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const displayName = author?.display_name || author?.name || 'Usuário';
  const authorSectorName = message.author?.sector_name || (isOwn ? sector?.name : null);
  const authorSectorColor = author?.sector_color || '#6366f1';
  const messageStatus = message.status || (message.id ? 'delivered' : 'sending');

  const parseCardMention = (lines: string[]): { taskNumber: number; title: string; description?: string; labels?: string; priority: string; dueDate?: string; boardName: string } | null => {
    if (lines.length < 2) return null;
    const match = lines[0].match(/^📋 Card #(\d+) — (.+)$/);
    if (!match) return null;
    let description: string | undefined, labels: string | undefined, priority = 'medium', dueDate: string | undefined, boardName = '';
    for (const line of lines.slice(1)) {
      if (line.startsWith('📝 ')) description = line.slice(3);
      else if (line.startsWith('🏷️ ')) labels = line.slice(3);
      else if (line.startsWith('⚡ Prioridade: ')) {
        const pLabel = line.replace('⚡ Prioridade: ', '');
        if (pLabel === 'Baixa') priority = 'low'; else if (pLabel === 'Média') priority = 'medium'; else if (pLabel === 'Alta') priority = 'high'; else if (pLabel === 'Urgente') priority = 'urgent';
      } else if (line.startsWith('📅 Prazo: ')) dueDate = line.replace('📅 Prazo: ', '');
      else if (line.startsWith('📌 Mural: ')) boardName = line.replace('📌 Mural: ', '');
    }
    return { taskNumber: parseInt(match[1]), title: match[2], description, labels, priority, dueDate, boardName };
  };

  const renderContent = (content: string, isOwnMsg: boolean) => {
    const __stk = parseSticker(content); if (__stk) return <span className="stk-msg"><StickerView sticker={__stk} size={140} /></span>;
    const lines = content.split('\n');
    const textLines: string[] = [];
    const attachments: { type: 'image' | 'file'; name: string; url: string }[] = [];
    const elements: React.ReactNode[] = [];
    let cardMentionLines: string[] = [];
    let inCardMention = false;
    const flushCardMention = () => {
      if (cardMentionLines.length > 0) {
        const card = parseCardMention(cardMentionLines);
        if (card) elements.push(<CardMentionCard key={`card-${card.taskNumber}`} {...card} isOwnMessage={isOwnMsg} />);
        else textLines.push(...cardMentionLines);
        cardMentionLines = []; inCardMention = false;
      }
    };
    for (const line of lines) {
      if (line.startsWith('📋 Card #')) { flushCardMention(); inCardMention = true; cardMentionLines.push(line); }
      else if (inCardMention && (line.startsWith('📝 ') || line.startsWith('🏷️ ') || line.startsWith('⚡ ') || line.startsWith('📅 ') || line.startsWith('📌 '))) cardMentionLines.push(line);
      else {
        flushCardMention();
        const imageMatch = line.match(/^📷 \[(.+?)\]\((.+?)\)$/);
        const fileMatch = line.match(/^📎 \[(.+?)\]\((.+?)\)$/);
        if (imageMatch) attachments.push({ type: 'image', name: imageMatch[1], url: imageMatch[2] });
        else if (fileMatch) attachments.push({ type: 'file', name: fileMatch[1], url: fileMatch[2] });
        else textLines.push(line);
      }
    }
    flushCardMention();
    const textContent = textLines.join('\n').trim();
    return <div className="min-w-0 max-w-full space-y-2">
      {textContent && <p className="chat-message-text whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{textContent.split('\n').map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{formatText(line, isOwnMsg)}</React.Fragment>)}</p>}
      {elements}
      {attachments.map((att, i) => att.type === 'image' ? (
        <SignedStorageLink key={i} url={att.url}><SignedStorageImage url={att.url} alt={att.name} className="max-w-full max-h-48 rounded-2xl object-cover" /></SignedStorageLink>
      ) : (
        <SignedStorageLink key={i} url={att.url} className={cn('flex max-w-full items-center gap-2 rounded-2xl p-2 text-xs', 'bg-muted/60 hover:bg-muted')}><span>📎</span><span className="min-w-0 truncate">{att.name}</span></SignedStorageLink>
      ))}
    </div>;
  };

  return <>
    <div className={cn('mobile-chat-message group relative flex w-full min-w-0 max-w-full items-start gap-3 sm:gap-4', isOwn && 'flex-row-reverse', isFocused && 'mobile-chat-message-focused z-[101]')} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => { setIsHovered(false); }}>
      <div className="relative z-10 shrink-0"><ChatSenderAvatar name={displayName} avatarUrl={author?.avatar_url} /></div>

      <div className={cn('flex w-0 min-w-0 flex-1 flex-col', isOwn && 'items-end')}>
        {isFocused && <div className="mobile-reaction-picker relative z-[320] mb-2 w-fit max-w-full self-center rounded-lg border border-border bg-card p-2 shadow-lg sm:hidden" onClick={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}>
          <ChatEmojiGrid emojis={QUICK_REACTIONS} onSelect={selectReaction} label="Escolher reação" />
        </div>}

        <div className={cn('relative z-10 mb-1 flex w-fit max-w-full flex-wrap items-center gap-1.5', isOwn && 'justify-end')}>
          <span className="min-w-0 max-w-full truncate text-xs font-medium text-foreground sm:text-sm">{displayName}</span>
          {authorSectorName && <span className="max-w-full break-words text-[10px] text-muted-foreground sm:text-xs">{authorSectorName}</span>}
        </div>

        <div className={cn('flex w-full min-w-0 max-w-full items-end gap-1.5', isOwn && 'flex-row-reverse')}>
          <div className="relative w-fit min-w-0 max-w-[90%] sm:max-w-[min(82%,620px)]" style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 160ms ease-out' : 'none' }}>
            <div onTouchStart={startLongPress} onTouchMove={handleTouchMove} onTouchEnd={finishTouch} onTouchCancel={finishTouch} onContextMenu={(event) => { event.preventDefault(); setIsFocused(true); setShowReactionPicker(false); }} style={{ touchAction: isFocused ? 'none' : 'pan-y' }} className={cn('chat-bubble relative min-w-0 max-w-full select-none', isOwn ? 'chat-bubble-outgoing' : 'chat-bubble-incoming', isFocused && 'z-[110]')}>
              {message.reply_to && <div className={cn('mb-1.5 max-w-full rounded-2xl px-2 py-1 text-[10px] border-l-2 cursor-pointer transition-colors sm:mb-2 sm:py-1.5 sm:text-xs', 'bg-muted/60 border-primary/50 hover:bg-muted')} onClick={() => message.reply_to?.id && onScrollToMessage?.(message.reply_to.id)}>
                <span className="font-semibold">{message.reply_to.reply_author?.display_name || message.reply_to.reply_author?.name || 'Usuário'}</span>
                <p className="mt-0.5 truncate opacity-80">{message.reply_to.content.substring(0, 100)}</p>
              </div>}
              {renderContent(message.content, isOwn)}
              <span className="chat-message-meta"><span>{formatTime(message.created_at)}</span>{isOwn && (messageStatus === 'sending' ? <Check className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5 text-primary" />)}</span>
            </div>

            {isFocused && <div className="fixed inset-0 z-[100] bg-background/20 backdrop-blur-[1px] md:hidden" onClick={closeFocus} aria-label="Fechar ações da mensagem" />}


          </div>

          <div className={cn('hidden shrink-0 items-center gap-0.5 transition-opacity sm:flex', (isHovered || isFocused || showReactionPicker) ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
            <button onClick={() => onReply?.(message)} className="p-1.5 rounded-2xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Responder"><Reply className="h-3.5 w-3.5" /></button>
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" title="Reagir" aria-label="Reagir à mensagem"><SmilePlus className="h-4 w-4" /></Button></PopoverTrigger>
              <PopoverContent side="top" align={isOwn ? 'end' : 'start'} collisionPadding={12} className="chat-emoji-popover z-[500] w-auto p-2">
                <ChatEmojiGrid emojis={QUICK_REACTIONS} onSelect={selectReaction} label="Escolher reação" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {reactions && reactions.length > 0 && <div className={cn('chat-reactions relative z-10 flex max-w-full flex-wrap gap-1 mt-1', isOwn && 'is-own justify-end')}>
          {reactions.map(r => <Popover key={r.emoji}><PopoverTrigger asChild><button type="button" className={cn('chat-reaction', r.reactedByMe && 'is-mine')}><span>{r.emoji}</span>{r.count > 1 ? <b>{r.count}</b> : null}</button></PopoverTrigger>
            <PopoverContent align={isOwn ? 'end' : 'start'} sideOffset={6} className="z-[500] w-64 p-2" onOpenAutoFocus={(e) => e.preventDefault()}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-foreground">{r.emoji} · {r.count}</span><button type="button" onClick={() => onToggleReaction?.(message.id, r.emoji)} className="text-xs text-primary hover:text-primary/80">{r.reactedByMe ? 'Remover' : 'Reagir'}</button></div><div className="mt-2 max-h-44 space-y-1 overflow-auto">{(r.reactors || []).length === 0 ? <p className="text-xs text-muted-foreground">Sem detalhes.</p> : (r.reactors || []).map(u => { const name = u.display_name || u.name || 'Usuário'; return <div key={u.id} className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarImage src={u.avatar_url || ''} alt={name} /><AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback></Avatar><span className="truncate text-xs text-foreground">{name}</span></div>; })}</div></PopoverContent>
          </Popover>)}
        </div>}
      </div>
    </div>
  </>;
}

export function DateSeparator({ date }: { date: string }) {
  const getLabel = (dateStr: string) => {
    const msgDate = new Date(dateStr), today = new Date(), yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (isSameDay(msgDate, today)) return 'Hoje';
    if (isSameDay(msgDate, yesterday)) return 'Ontem';
    return msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  return <div className="flex items-center justify-center my-4"><span className="chat-date-label px-3 py-1 text-[11px] font-medium">{getLabel(date)}</span></div>;
}
// Memoized: re-rendering every bubble on each parent state change (scroll,
// typing, presence) was freezing the chat scroll.
export const ChatMessage = memo(ChatMessageBase, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.content === next.message.content &&
  prev.message.author === next.message.author &&
  prev.reactions === next.reactions &&
  prev.onReply === next.onReply &&
  prev.onToggleReaction === next.onToggleReaction &&
  prev.onScrollToMessage === next.onScrollToMessage
);
