import { useState } from 'react';
import { Home, MessageSquare, Bell, Cake, MoreHorizontal, BarChart3, Settings, Camera, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface MobileNavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const mainNavItems = [
  { id: 'home', icon: Home, label: 'Início' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'announcements', icon: Bell, label: 'Avisos' },
  { id: 'birthdays', icon: Cake, label: 'Aniversários' },
];

const moreNavItems = [
  { id: 'charts', icon: BarChart3, label: 'Gráficos', adminOnly: true },
  { id: 'facial', icon: Camera, label: 'Cadastro Facial' },
  { id: 'management', icon: Settings, label: 'Gerenciamento', permission: 'can_access_management' as const },
  { id: 'data-management', icon: Trash2, label: 'Exclusão de Dados', adminOnly: true },
];

export function MobileNavigation({ activeSection, onSectionChange }: MobileNavigationProps) {
  const { isAdmin, canAccess } = useAuth();
  const { counts } = useNotifications();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const visibleMoreItems = moreNavItems.filter((item) => {
    // Admin-only items
    if ('adminOnly' in item && item.adminOnly) {
      return isAdmin;
    }
    // Permission-based items
    if ('permission' in item) {
      if (isAdmin) return true;
      return canAccess(item.permission);
    }
    return true;
  });

  const isMoreActive = moreNavItems.some(item => item.id === activeSection);

  const handleMoreItemClick = (id: string) => {
    onSectionChange(id);
    setShowMoreMenu(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => {
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

          {/* More Button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-0 px-1 transition-colors',
              isMoreActive 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className={cn('h-6 w-6', isMoreActive && 'text-primary')} />
            <span className={cn(
              'text-[10px] font-medium truncate max-w-full',
              isMoreActive && 'text-primary'
            )}>
              Mais
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={showMoreMenu} onOpenChange={setShowMoreMenu}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Mais opções</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pb-6">
            {visibleMoreItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleMoreItemClick(item.id)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl p-4 transition-colors',
                    isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
