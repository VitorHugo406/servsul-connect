import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MessageCircle, User as UserIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversations, useActiveUsers } from '@/hooks/useDirectMessages';
import { useSectors } from '@/hooks/useData';
import { useAllUsersPresence } from '@/hooks/usePresence';
import { PresenceIndicator } from '@/components/user/PresenceIndicator';
import { cn } from '@/lib/utils';

interface DirectMessageListProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function DirectMessageList({ selectedUserId, onSelectUser }: DirectMessageListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllUsers, setShowAllUsers] = useState(false);
  const { conversations, loading: conversationsLoading } = useConversations();
  const { users, loading: usersLoading } = useActiveUsers();
  const { sectors } = useSectors();
  const { getUserPresence } = useAllUsersPresence();

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
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = conv.partner.display_name || conv.partner.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredUsers = users.filter((user) => {
    const name = user.display_name || user.name || '';
    const hasConversation = conversations.some(c => c.partnerId === user.id);
    return name.toLowerCase().includes(searchQuery.toLowerCase()) && (!hasConversation || showAllUsers);
  });

  const loading = conversationsLoading || usersLoading;

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-4">
        <h3 className="mb-3 font-display text-lg font-semibold text-foreground">
          Mensagens Diretas
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setShowAllUsers(false)}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            !showAllUsers
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageCircle className="mr-1.5 inline h-4 w-4" />
          Conversas
        </button>
        <button
          onClick={() => setShowAllUsers(true)}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            showAllUsers
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserIcon className="mr-1.5 inline h-4 w-4" />
          Usuários
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="p-2">
            {!showAllUsers ? (
              // Conversations list
              filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma conversa ainda
                  </p>
                  <button
                    onClick={() => setShowAllUsers(true)}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Iniciar nova conversa
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const sector = sectors.find(s => s.id === conv.partner.sector_id);
                  const displayName = conv.partner.display_name || conv.partner.name;
                  const partnerUserId = (conv.partner as any).user_id || conv.partnerId;
                  const presence = getUserPresence(partnerUserId);
                  
                  return (
                    <motion.button
                      key={conv.partnerId}
                      onClick={() => onSelectUser(conv.partnerId)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors min-h-[64px]',
                        selectedUserId === conv.partnerId
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={conv.partner.avatar_url || ''} />
                          <AvatarFallback
                            className="text-sm text-white"
                            style={{ backgroundColor: sector?.color || '#6366f1' }}
                          >
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceIndicator
                          isOnline={presence.isOnline}
                          lastHeartbeat={presence.lastHeartbeat}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground truncate">{displayName}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTime(conv.lastMessage.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate max-w-full overflow-hidden">
                          {conv.lastMessage.content}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <Badge className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-xs flex-shrink-0">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </motion.button>
                  );
                })
              )
            ) : (
              // All users list
              filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum usuário encontrado
                  </p>
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const sector = sectors.find(s => s.id === user.sector_id);
                  const displayName = user.display_name || user.name;
                  const presence = getUserPresence(user.user_id || user.id);
                  
                  return (
                    <motion.button
                      key={user.id}
                      onClick={() => {
                        onSelectUser(user.id);
                        setShowAllUsers(false);
                      }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors min-h-[64px]',
                        selectedUserId === user.id
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback
                            className="text-sm text-white"
                            style={{ backgroundColor: sector?.color || '#6366f1' }}
                          >
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceIndicator
                          isOnline={presence.isOnline}
                          lastHeartbeat={presence.lastHeartbeat}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground truncate block">{displayName}</span>
                        {sector && (
                          <p className="text-xs text-muted-foreground">{sector.name}</p>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}