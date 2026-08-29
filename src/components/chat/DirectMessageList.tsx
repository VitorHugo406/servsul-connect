import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, User as UserIcon, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversations, useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAllUsersPresence } from '@/hooks/usePresence';
import { PresenceIndicator } from '@/components/user/PresenceIndicator';
import { ChatPersonalizationDialog } from '@/components/chat/ChatPersonalizationDialog';
import { cn } from '@/lib/utils';

interface DirectMessageListProps { selectedUserId: string | null; onSelectUser: (userId: string) => void; }

export function DirectMessageList({ selectedUserId, onSelectUser }: DirectMessageListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const { conversations, loading: conversationsLoading } = useConversations();
  const { users, loading: usersLoading } = useActiveUsers();
  const { sectors } = useSectors();
  const { getUserPresence } = useAllUsersPresence();
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const formatTime = (dateStr: string) => { const date = new Date(dateStr); const now = new Date(); const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)); if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); if (diffDays === 1) return 'Ontem'; if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' }); return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
  const query = searchQuery.toLowerCase();
  const filteredConversations = conversations.filter(conv => (conv.partner.display_name || conv.partner.name || '').toLowerCase().includes(query));
  const filteredUsers = users.filter(user => { const name = user.display_name || user.name || ''; const hasConversation = conversations.some(c => c.partnerId === user.id); return name.toLowerCase().includes(query) && !hasConversation; });
  const loading = conversationsLoading || usersLoading;
  const selectedPartner = users.find(user => user.id === selectedUserId) || conversations.find(conv => conv.partnerId === selectedUserId)?.partner;
  const selectedPartnerName = selectedPartner?.display_name || selectedPartner?.name || 'Conversa individual';

  useEffect(() => {
    const fakeConversationButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Conversas');
    if (fakeConversationButton) fakeConversationButton.style.display = 'none';
    return () => { if (fakeConversationButton) fakeConversationButton.style.display = ''; };
  }, []);

  return <div className="flex h-full flex-col border-r border-border bg-card overflow-hidden">
    <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/65 px-3 py-2 backdrop-blur-2xl">
      <h3 className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">Mensagens individuais</h3>
      <div className="relative w-[42%] min-w-[130px]"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar conversas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 rounded-full border-border/60 bg-background/65 pl-8 pr-2 text-xs" /></div>
      <button type="button" onClick={() => setShowPersonalization(true)} title="Personalizar chat" aria-label="Personalizar chat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/65 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Settings className="h-4 w-4" /></button>
    </div>
    <div className="hidden h-0" aria-hidden="true" />
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 border-b border-border/60 bg-card/40">
        <button onClick={() => setShowAllUsers(false)} className={cn('flex-1 px-3 py-2 text-xs font-medium transition-colors', !showAllUsers ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><MessageCircle className="mr-1.5 inline h-3.5 w-3.5" />Recentes</button>
        <button onClick={() => setShowAllUsers(true)} className={cn('flex-1 px-3 py-2 text-xs font-medium transition-colors', showAllUsers ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}><UserIcon className="mr-1.5 inline h-3.5 w-3.5" />Contatos</button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? <div className="flex items-center justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : <div className="p-2">
          {!showAllUsers ? (
            filteredConversations.length === 0 ? <div className="flex flex-col items-center justify-center py-8 text-center"><MessageCircle className="mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Nenhuma conversa recente</p><button onClick={() => setShowAllUsers(true)} className="mt-2 text-sm text-primary hover:underline">Ver contatos</button></div> : filteredConversations.map(conv => {
              const sector = sectors.find(s => s.id === conv.partner.sector_id);
              const displayName = conv.partner.display_name || conv.partner.name;
              const partnerUserId = (conv.partner as any).user_id || conv.partnerId;
              const presence = getUserPresence(partnerUserId);
              return <motion.button key={conv.partnerId} onClick={() => onSelectUser(conv.partnerId)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className={cn('flex w-full items-center gap-3 rounded-[22px] p-3 text-left transition-colors min-h-[64px]', selectedUserId === conv.partnerId ? 'bg-primary/10' : 'hover:bg-muted')}><div className="relative flex-shrink-0"><Avatar className="h-10 w-10"><AvatarImage src={conv.partner.avatar_url || ''} /><AvatarFallback className="text-sm text-white" style={{ backgroundColor: sector?.color || '#6366f1' }}>{getInitials(displayName)}</AvatarFallback></Avatar><PresenceIndicator isOnline={presence.isOnline} lastHeartbeat={presence.lastHeartbeat} /></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-2"><span className="font-medium text-foreground truncate">{displayName}</span><span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(conv.lastMessage.created_at)}</span></div><p className="text-sm text-muted-foreground truncate max-w-[200px]">{conv.lastMessage.content}</p></div>{conv.unreadCount > 0 && <Badge className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-xs flex-shrink-0">{conv.unreadCount}</Badge>}</motion.button>;
            })
          ) : (
            filteredUsers.length === 0 ? <div className="flex flex-col items-center justify-center py-8 text-center"><UserIcon className="mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Nenhum contato encontrado</p></div> : filteredUsers.map(user => {
              const sector = sectors.find(s => s.id === user.sector_id);
              const displayName = user.display_name || user.name;
              const presence = getUserPresence(user.user_id || user.id);
              return <motion.button key={user.id} onClick={() => { onSelectUser(user.id); setShowAllUsers(false); }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className={cn('flex w-full items-center gap-3 rounded-[22px] p-3 text-left transition-colors min-h-[64px]', selectedUserId === user.id ? 'bg-primary/10' : 'hover:bg-muted')}><div className="relative flex-shrink-0"><Avatar className="h-10 w-10"><AvatarImage src={user.avatar_url || ''} /><AvatarFallback className="text-sm text-white" style={{ backgroundColor: sector?.color || '#6366f1' }}>{getInitials(displayName)}</AvatarFallback></Avatar><PresenceIndicator isOnline={presence.isOnline} lastHeartbeat={presence.lastHeartbeat} /></div><div className="flex-1 min-w-0"><span className="font-medium text-foreground truncate block">{displayName}</span>{sector && <p className="text-xs text-muted-foreground">{sector.name}</p>}</div></motion.button>;
            })
          )}
        </div>}
      </ScrollArea>
    </div>
    <ChatPersonalizationDialog open={showPersonalization} onOpenChange={setShowPersonalization} chatId={selectedUserId} chatName={selectedPartnerName} />
  </div>;
}
