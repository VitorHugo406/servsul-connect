import { parseUnreadMarks, updateUnreadMarks } from '@/lib/chatUnread';

// Remembers which conversation was just favorited so its star can "pop" even after the row moves to the Favoritos section.
let popKey = ''; let popAt = 0;
export const justFavorited = (conversationKey: string) => popKey === conversationKey && Date.now() - popAt < 700;

/** Adds/removes a conversation from the profile's favorites (browser storage only, like before) and tells the lists to refresh. */
export function setChatFavorite(favoriteKey: string | null, conversationKey: string, value: boolean) {
  if (!favoriteKey) return;
  try {
    localStorage.setItem(favoriteKey, JSON.stringify(updateUnreadMarks(parseUnreadMarks(localStorage.getItem(favoriteKey)), conversationKey, value)));
    if (value) { popKey = conversationKey; popAt = Date.now(); }
    window.dispatchEvent(new Event('nuvexa:favorites-changed'));
  } catch { /* storage unavailable */ }
}
