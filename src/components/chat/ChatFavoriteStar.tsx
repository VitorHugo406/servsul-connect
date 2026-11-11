import { Star } from 'lucide-react';
import { useChatListMarks } from '@/hooks/useChatListMarks';
import { justFavorited, setChatFavorite } from '@/lib/chatFavorite';
import { cn } from '@/lib/utils';

/** Gold star beside the conversation name in the header: filled when favorite (click toggles), pops when just favorited. */
export function ChatFavoriteStar({ conversationKey }: { conversationKey: string }) {
  const { favorites, favoriteKey } = useChatListMarks();
  const fav = favorites.includes(conversationKey);
  return <button type="button" className={cn('chat-fav-star', fav && 'is-fav', fav && justFavorited(conversationKey) && 'is-pop')} aria-pressed={fav} title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} onClick={() => setChatFavorite(favoriteKey, conversationKey, !fav)}><Star /></button>;
}
