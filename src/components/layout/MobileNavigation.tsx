import { Home, MessageSquare, Bell, Cake, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';

interface MobileNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: 'home', icon: Home, label: 'Início' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'announcements', icon: Bell, label: 'Avisos' },
  { id: 'birthdays', icon: Cake, label: 'Aniversários' },
  { id: 'management', icon: Settings, label: 'Gestão', permission: 'can_access_management' as const },
];

export function MobileNavigation({ activeSection, onSectionChange }: MobileNavigationProps) {
  const { isAdmin, canAccess } = useAuth();
  const { counts } = useNotifications();

  const visibleItems = navItems.filter((item) => {
    if (!('permission' in item)) return true;
    if (isAdmin) return true;
    return canAccess(item.permission);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          let badgeCount = 0;
          if (item.id === 'chat') badgeCount = counts.unreadMessages;
          if (item.id === 'announcements') badgeCount = counts.unreadAnnouncements;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 px-1 transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-6 w-6', isActive && 'text-primary')} />
                {badgeCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className={cn(
                'text-[10px] font-medium truncate max-w-full',
                isActive && 'text-primary'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
