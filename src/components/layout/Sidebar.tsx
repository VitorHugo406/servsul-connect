import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { UsersRound, Mail, FileText, HardDrive, CalendarDays, BookOpen, Shield, LayoutDashboard, Globe, ClipboardCheck, StickyNote, Megaphone } from 'lucide-react';
import appLogo from '@/assets/nuvexa-logo.png';
import { 
  MessageSquare, 
  Bell, 
  ChevronLeft,
  ChevronRight,
  Home,
  Cake,
  Settings,
  LogOut,
  Trash2,
  Building2,
  Sparkles,
  ListTodo
} from 'lucide-react';
import { SeasonalEffectsButton } from '@/components/seasonal/SeasonalEffectsButton';
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
  { id: 'war-room', icon: Shield, label: 'War Room' },
   { id: 'tasks', icon: ListTodo, label: 'Tarefas' },
  { id: 'people-management', icon: UsersRound, label: 'Gestão de Pessoas', supervisorOnly: true },
  
  { id: 'management', icon: Settings, label: 'Gerenciamento', permission: 'can_access_management' as const },
  { id: 'companies', icon: Building2, label: 'Empresas', superAdminOnly: true },
  { id: 'system-broadcasts', icon: Megaphone, label: 'Comunicados Globais', superAdminOnly: true },
  { id: 'sectors', icon: Building2, label: 'Gestão de Setores', adminOnly: true },
   { id: 'important-announcements', icon: Sparkles, label: 'Comunicados Importantes', adminOnly: true },
  { id: 'data-management', icon: Trash2, label: 'Exclusão de Dados', adminOnly: true },
  { id: 'feedback-email', icon: Mail, label: 'Disparo de Feedback', adminOnly: true },
  { id: 'my-dashboard', icon: LayoutDashboard, label: 'Meu Painel' },
  { id: 'evaluations', icon: ClipboardCheck, label: 'Avaliações' },
  { id: 'notes', icon: StickyNote, label: 'Anotações' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendário' },
  { id: 'system-logs', icon: FileText, label: 'Logs do Sistema', mainAdminOnly: true },
  { id: 'event-history', icon: Sparkles, label: 'Eventos Mensais', adminOnly: true },
  { id: 'api-management', icon: Globe, label: 'API Integração', adminOnly: true },
  { id: 'storage', icon: HardDrive, label: 'Armazenamento', superAdminOnly: true },
  { id: 'documentation', icon: BookOpen, label: 'Documentação', mainAdminOnly: true },
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
  const { profile, signOut, isAdmin, canAccess, roles } = useAuth();
  const { counts } = useNotifications();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');

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
    if ('superAdminOnly' in item && (item as any).superAdminOnly) {
      return isSuperAdmin;
    }
    // Main admin only items (specific email)
    if ('mainAdminOnly' in item && item.mainAdminOnly) {
      return isAdmin && profile?.email === 'adminservchat@servsul.com.br';
    }
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
      if (profile?.autonomy_level === 'diretoria') return true;
      return canAccess(item.permission);
    }
    return true;
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative m-3 flex h-[calc(100vh-1.5rem)] flex-col rounded-[28px] bg-sidebar text-sidebar-foreground shadow-xl"
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <motion.div
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
          className="flex items-center gap-3 overflow-hidden"
        >
          <img src={appLogo} alt="Nuvexa" className="h-10 w-10 object-contain rounded-xl" />
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">Nuvexa</h1>
            <p className="text-xs text-sidebar-foreground/60">Nuvexa</p>
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
      <nav className="flex-1 overflow-hidden p-3">
        <ScrollArea className="h-full [&_[data-radix-scroll-area-scrollbar]]:hidden">
        <div className="space-y-1">
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
                'group relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200',
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
        </div>
        </ScrollArea>
      </nav>

      {/* Seasonal Effects Button */}
      <div className="px-3 pb-1">
        <SeasonalEffectsButton collapsed={isCollapsed} />
      </div>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-3">
        <motion.div
          className={cn(
            'flex items-center gap-3 rounded-2xl bg-sidebar-accent/60 p-3 shadow-sm',
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
