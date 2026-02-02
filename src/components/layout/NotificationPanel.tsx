import { useEffect, useState } from 'react';
import { Bell, MessageSquare, Megaphone, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnreadMessage {
  id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UnreadAnnouncement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: {
    name: string;
    avatar_url: string | null;
  };
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToChat?: () => void;
  onNavigateToAnnouncements?: () => void;
}

export function NotificationPanel({ 
  open, 
  onOpenChange, 
  onNavigateToChat, 
  onNavigateToAnnouncements 
}: NotificationPanelProps) {
  const { profile, user } = useAuth();
  const { counts, markDirectMessagesAsRead, markAnnouncementAsRead } = useNotifications();
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<UnreadAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && profile && user) {
      fetchNotificationDetails();
    }
  }, [open, profile, user, counts]);

  const fetchNotificationDetails = async () => {
    if (!profile || !user) return;
    
    setLoading(true);
    try {
      // Fetch unread direct messages with sender info
      const { data: messages, error: msgError } = await supabase
        .from('direct_messages')
        .select(`
          id,
          content,
          created_at,
          sender:profiles!direct_messages_sender_id_fkey(id, name, display_name, avatar_url)
        `)
        .eq('receiver_id', profile.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (msgError) {
        console.error('Error fetching unread messages:', msgError);
      } else {
        setUnreadMessages((messages || []).map(m => ({
          ...m,
          sender: m.sender as unknown as UnreadMessage['sender']
        })));
      }

      // Fetch active announcements
      const now = new Date().toISOString();
      const { data: announcements, error: annError } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          created_at,
          author:profiles!announcements_author_id_fkey(name, avatar_url)
        `)
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`expire_at.is.null,expire_at.gt.${now}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (annError) {
        console.error('Error fetching announcements:', annError);
      } else {
        // Get read announcements
        const { data: readAnn } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', user.id);

        const readIds = new Set((readAnn || []).map(r => r.announcement_id));
        const unread = (announcements || []).filter(a => !readIds.has(a.id));
        
        setUnreadAnnouncements(unread.slice(0, 10).map(a => ({
          ...a,
          author: a.author as unknown as UnreadAnnouncement['author']
        })));
      }
    } catch (error) {
      console.error('Error fetching notification details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const handleMessageClick = async (senderId: string) => {
    await markDirectMessagesAsRead(senderId);
    // Update local state immediately
    setUnreadMessages(prev => prev.filter(m => m.sender.id !== senderId));
    onOpenChange(false);
    onNavigateToChat?.();
  };

  const handleAnnouncementClick = async (announcementId: string) => {
    await markAnnouncementAsRead(announcementId);
    // Update local state immediately
    setUnreadAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    onOpenChange(false);
    onNavigateToAnnouncements?.();
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
            {counts.total > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {counts.total}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : counts.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h4 className="font-medium text-foreground">Tudo em dia!</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Você não tem notificações pendentes
              </p>
            </div>
          ) : (
            <div className="p-2">
              {/* Unread Messages Section */}
              {unreadMessages.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    Mensagens não lidas ({unreadMessages.length})
                  </div>
                  <div className="space-y-1">
                    {unreadMessages.map((msg) => (
                      <button
                        key={msg.id}
                        onClick={() => handleMessageClick(msg.sender.id)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={msg.sender.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(msg.sender.display_name || msg.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-foreground truncate">
                              {msg.sender.display_name || msg.sender.name}
                            </p>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {truncateContent(msg.content)}
                          </p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Separator */}
              {unreadMessages.length > 0 && unreadAnnouncements.length > 0 && (
                <Separator className="my-4" />
              )}

              {/* Unread Announcements Section */}
              {unreadAnnouncements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-muted-foreground">
                    <Megaphone className="h-4 w-4" />
                    Avisos não lidos ({unreadAnnouncements.length})
                  </div>
                  <div className="space-y-1">
                    {unreadAnnouncements.map((ann) => (
                      <button
                        key={ann.id}
                        onClick={() => handleAnnouncementClick(ann.id)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 flex-shrink-0">
                          <Megaphone className="h-5 w-5 text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm text-foreground truncate">
                              {ann.title}
                            </p>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTime(ann.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {truncateContent(ann.content)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Por {ann.author?.name || 'Desconhecido'}
                          </p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-secondary flex-shrink-0 mt-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
