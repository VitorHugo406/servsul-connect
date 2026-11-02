import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { chatUnreadStorageKey, parseUnreadMarks } from '@/lib/chatUnread';

export function useChatListMarks() {
  const { profile } = useAuth();
  const unreadKey = profile ? chatUnreadStorageKey(profile.company_id, profile.id) : null;
  const favoriteKey = profile ? `nuvexa:chat-favorites:${profile.company_id}:${profile.id}` : null;
  const [unread, setUnread] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const load = () => {
      try { setUnread(parseUnreadMarks(unreadKey ? localStorage.getItem(unreadKey) : null)); setFavorites(parseUnreadMarks(favoriteKey ? localStorage.getItem(favoriteKey) : null)); }
      catch { setUnread([]); setFavorites([]); }
    };
    load();
    window.addEventListener('nuvexa:unread-changed', load);
    window.addEventListener('nuvexa:favorites-changed', load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener('nuvexa:unread-changed', load); window.removeEventListener('nuvexa:favorites-changed', load); window.removeEventListener('storage', load); };
  }, [unreadKey, favoriteKey]);
  return { unread, favorites, favoriteKey };
}