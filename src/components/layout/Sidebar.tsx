import { useState } from 'react';
import { motion } from 'framer-motion';
import { UsersRound } from 'lucide-react';
import { 
  MessageSquare, 
  Bell, 
  ChevronLeft,
  ChevronRight,
  Home,
  Cake,
  BarChart3,
  Settings,
  LogOut,
  Trash2,
   Building2,
   Sparkles,
   ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'home', icon: Home, label: 'Início' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'announcements', icon: Bell, label: 'Avisos' },
  { id: 'birthdays', icon: Cake, label: 'Aniversariantes' },
   { id: 'tasks', icon: ListTodo, label: 'Tarefas' },
  { id: 'people-management', icon: UsersRound, label: 'Gestão de Pessoas', supervisorOnly: true },
  { id: 'charts', icon: BarChart3, label: 'Gráficos', adminOnly: true },
  { id: 'management', icon: Settings, label: 'Gerenciamento', permission: 'can_access_management' as const },
  { id: 'sectors', icon: Building2, label: 'Gestão de Setores', adminOnly: true },
   { id: 'important-announcements', icon: Sparkles, label: 'Comunicados Importantes', adminOnly: true },
  { id: 'data-management', icon: Trash2, label: 'Exclusão de Dados', adminOnly: true },
];

const autonomyLevelLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
   gestor: 'Gestor',
   diretoria: 'Diretoria',
  supervisor: 'Supervisor',
  colaborador: 'Colaborador',
};

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, signOut, isAdmin, canAccess } = useAuth();
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
  const autonomyLevel = profile?.autonomy_level || 'colaborador';

  // Filter menu items based on permissions
  const visibleMenuItems = menuItems.filter((item) => {
    // Admin-only items
    if ('adminOnly' in item && item.adminOnly) {
      return isAdmin;
    }
    // Supervisor-only items (supervisors, gerentes, admins)
    if ('supervisorOnly' in item && item.supervisorOnly) {
      if (isAdmin) return true;
      const level = profile?.autonomy_level;
      return level === 'supervisor' || level === 'gerente' || level === 'gestor' || level === 'diretoria';
    }
    // Permission-based items
    if ('permission' in item) {
      if (isAdmin) return true;
      return canAccess(item.permission);
    }
    return true;
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex h-screen flex-col bg-sidebar text-sidebar-foreground"
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <motion.div
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-secondary shadow-glow">
            <MessageSquare className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">ServChat</h1>
            <p className="text-xs text-sidebar-foreground/60">Grupo Servsul</p>
          </div>
        </motion.div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          // Get badge count for this item
          let badgeCount = 0;
          if (item.id === 'chat') {
            badgeCount = counts.unreadMessages;
          } else if (item.id === 'announcements') {
            badgeCount = counts.unreadAnnouncements;
          }
          
          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary-foreground')} />
                {badgeCount > 0 && !isCollapsed && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -right-2 -top-2 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] bg-secondary text-secondary-foreground"
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              
              <motion.span
                initial={false}
                animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
                className="overflow-hidden whitespace-nowrap font-medium"
              >
                {item.label}
              </motion.span>

              {badgeCount > 0 && isCollapsed && (
                <Badge 
                  variant="secondary" 
                  className="absolute right-1 top-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] bg-secondary text-secondary-foreground"
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Badge>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3">
        <motion.div
          className={cn(
            'flex items-center gap-3 rounded-xl bg-sidebar-accent/50 p-3',
            isCollapsed && 'justify-center'
          )}
        >
          <div className="relative">
            <Avatar className="h-10 w-10 ring-2 ring-sidebar-primary ring-offset-2 ring-offset-sidebar">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sidebar bg-success" />
          </div>
          
          <motion.div
            initial={false}
            animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
            className="flex-1 overflow-hidden"
          >
            <p className="truncate font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {autonomyLevelLabels[autonomyLevel]}
            </p>
          </motion.div>
          
          {!isCollapsed && (
            <button 
              onClick={signOut}
              className="rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </div>
    </motion.aside>
  );
}
