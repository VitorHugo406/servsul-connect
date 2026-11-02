export type ChatListFilter = 'all' | 'direct' | 'groups' | 'sectors' | 'unread' | 'favorites';
export function matchesChatFilter(filter: ChatListFilter, kind: 'direct' | 'groups' | 'sectors', key: string, unreadCount: number, unread: readonly string[], favorites: readonly string[]) {
  if (filter === 'unread') return unreadCount > 0 || unread.includes(key);
  if (filter === 'favorites') return favorites.includes(key);
  return filter === 'all' || filter === kind;
}