import { ReactNode, useEffect, useState } from 'react';
import { Mail, MailOpen, MoreHorizontal, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { chatUnreadStorageKey, parseUnreadMarks, updateUnreadMarks } from '@/lib/chatUnread';
import { useChatListMarks } from '@/hooks/useChatListMarks';
import { justFavorited, setChatFavorite } from '@/lib/chatFavorite';

export function ChatConversationItem({ conversationKey, children }: { conversationKey: string; children: ReactNode }) {
  const { profile } = useAuth();
  const storageKey = profile ? chatUnreadStorageKey(profile.company_id, profile.id) : null;
  const [unread, setUnread] = useState(false);
  const { favorites, favoriteKey } = useChatListMarks();
  const isFavorite = favorites.includes(conversationKey);
  const toggleFavorite = () => setChatFavorite(favoriteKey, conversationKey, !isFavorite);
  useEffect(() => {
    const load = () => {
      try { setUnread(storageKey ? parseUnreadMarks(localStorage.getItem(storageKey)).includes(conversationKey) : false); }
      catch { setUnread(false); }
    };
    load();
    window.addEventListener('nuvexa:unread-changed', load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener('nuvexa:unread-changed', load); window.removeEventListener('storage', load); };
  }, [storageKey, conversationKey]);
  const mark = (value: boolean) => {
    if (!storageKey) return;
    try {
      const marks = updateUnreadMarks(parseUnreadMarks(localStorage.getItem(storageKey)), conversationKey, value);
      localStorage.setItem(storageKey, JSON.stringify(marks));
      setUnread(value);
      window.dispatchEvent(new Event('nuvexa:unread-changed'));
    } catch { setUnread(value); }
  };
  return <div className="chat-conversation-item relative min-w-0 max-w-full overflow-hidden" data-favorite={isFavorite || undefined} data-fav-pop={(isFavorite && justFavorited(conversationKey)) || undefined} data-manual-unread={unread || undefined} onClick={() => mark(false)}>
    {children}
    <div className="absolute right-3 top-1.5 z-10" onClick={event => event.stopPropagation()}>
      <DropdownMenu><DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Opções da conversa" title="Opções da conversa"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => mark(!unread)}>{unread ? <MailOpen className="mr-2 h-4 w-4" /> : <Mail className="mr-2 h-4 w-4" />}{unread ? 'Marcar como lida' : 'Marcar como não lida'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleFavorite}><Star className="mr-2 h-4 w-4" />{isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
  </div>;
}