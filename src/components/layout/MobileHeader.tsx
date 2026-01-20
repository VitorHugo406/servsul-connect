import { Bell, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
}

export function MobileHeader({ title, subtitle }: MobileHeaderProps) {
  const { profile } = useAuth();
  const { counts } = useNotifications();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const totalNotifications = counts.unreadMessages + counts.unreadAnnouncements;

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border safe-area-pt">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-full hover:bg-accent">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {totalNotifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {totalNotifications > 99 ? '99+' : totalNotifications}
              </Badge>
            )}
          </button>

          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
