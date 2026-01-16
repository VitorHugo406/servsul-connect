import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Bell, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Cake,
  ChevronLeft,
  ChevronRight,
  Home
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { currentUser, autonomyLevelLabels } from '@/data/mockData';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const menuItems = [
  { id: 'home', icon: Home, label: 'Início', badge: null },
  { id: 'chat', icon: MessageSquare, label: 'Chat', badge: 3 },
  { id: 'announcements', icon: Bell, label: 'Avisos', badge: 2 },
  { id: 'birthdays', icon: Cake, label: 'Aniversariantes', badge: null },
  { id: 'charts', icon: BarChart3, label: 'Gráficos', badge: null },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

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
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
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
              <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-sidebar-primary-foreground')} />
              
              <motion.span
                initial={false}
                animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
                className="overflow-hidden whitespace-nowrap font-medium"
              >
                {item.label}
              </motion.span>
              
              {item.badge && !isCollapsed && (
                <Badge className="ml-auto bg-secondary text-secondary-foreground">
                  {item.badge}
                </Badge>
              )}
              
              {item.badge && isCollapsed && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                  {item.badge}
                </span>
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
              <AvatarImage src={currentUser.avatar} alt={currentUser.displayName} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
                {getInitials(currentUser.displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-sidebar bg-success" />
          </div>
          
          <motion.div
            initial={false}
            animate={{ opacity: isCollapsed ? 0 : 1, width: isCollapsed ? 0 : 'auto' }}
            className="flex-1 overflow-hidden"
          >
            <p className="truncate font-medium text-sidebar-foreground">{currentUser.displayName}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {autonomyLevelLabels[currentUser.autonomyLevel]}
            </p>
          </motion.div>
          
          {!isCollapsed && (
            <button className="rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <Settings className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </div>
    </motion.aside>
  );
}
