import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { UsersRound, Mail, FileText, HardDrive, CalendarDays, BookOpen, Shield, Globe, ClipboardCheck, Megaphone, Link, MessageSquare, Bell, Home, Cake, Settings, Trash2, Building2, Sparkles } from 'lucide-react';
import { SeasonalEffectsButton } from '@/components/seasonal/SeasonalEffectsButton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface SidebarProps { activeSection: string; onSectionChange: (section: string) => void; }
const menuItems = [
  { id: 'home', icon: Home, label: 'Início' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'announcements', icon: Bell, label: 'Avisos' },
  { id: 'birthdays', icon: Cake, label: 'Aniversariantes' },
  { id: 'war-room', icon: Shield, label: 'War Room' },
  { id: 'management', icon: Settings, label: 'Gerenciamento', permission: 'can_access_management' as const },
  { id: 'shortcuts', icon: Link, label: 'Atalhos do Sistema', adminOnly: true },
  { id: 'companies', icon: Building2, label: 'Empresas', superAdminOnly: true },
  { id: 'system-broadcasts', icon: Megaphone, label: 'Comunicados Globais', superAdminOnly: true },
  { id: 'sectors', icon: Building2, label: 'Gestão de Setores', adminOnly: true },
  { id: 'important-announcements', icon: Sparkles, label: 'Comunicados Importantes', adminOnly: true },
  { id: 'data-management', icon: Trash2, label: 'Exclusão de Dados', adminOnly: true },
  { id: 'feedback-email', icon: Mail, label: 'Disparo de Feedback', adminOnly: true },
  { id: 'evaluations', icon: ClipboardCheck, label: 'Avaliações' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendário' },
  { id: 'system-logs', icon: FileText, label: 'Logs do Sistema', mainAdminOnly: true },
  { id: 'event-history', icon: Sparkles, label: 'Eventos Mensais', adminOnly: true },
  { id: 'api-management', icon: Globe, label: 'API Integração', adminOnly: true },
  { id: 'storage', icon: HardDrive, label: 'Armazenamento', superAdminOnly: true },
  { id: 'documentation', icon: BookOpen, label: 'Documentação', mainAdminOnly: true },
];
export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { profile, isAdmin, canAccess, roles } = useAuth();
  const { counts } = useNotifications();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');
  const visibleMenuItems = menuItems.filter(item => {
    if ('superAdminOnly' in item && item.superAdminOnly) return isSuperAdmin;
    if ('mainAdminOnly' in item && item.mainAdminOnly) return isAdmin && profile?.email === 'adminservchat@servsul.com.br';
    if ('adminOnly' in item && item.adminOnly) return isAdmin;
    if ('permission' in item) {
      if (isAdmin || profile?.autonomy_level === 'diretoria') return true;
      return canAccess(item.permission);
    }
    return true;
  });
  return (
    <motion.aside initial={false} animate={{ width: 64 }} transition={{ duration: 0.2, ease: 'easeOut' }}
      className="ewvon-sidebar fixed left-0 top-0 z-40 flex h-screen w-16 shrink-0 flex-col items-center border-r border-slate-200/80 bg-white text-slate-700"
      aria-label="Navegação principal">
      <nav className="flex min-h-0 w-full flex-1 flex-col items-center overflow-hidden py-2">
        <ScrollArea className="h-full w-full [&_[data-radix-scroll-area-scrollbar]]:hidden">
          <div className="flex flex-col items-center gap-1 px-2">
            {visibleMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const badgeCount = item.id === 'chat' ? counts.unreadMessages : item.id === 'announcements' ? counts.unreadAnnouncements : 0;
              return (
                <motion.button key={item.id} type="button" onClick={() => onSectionChange(item.id)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  aria-label={item.label} aria-current={isActive ? 'page' : undefined} title={item.label}
                  className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
                    isActive ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>
                  <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
                  {badgeCount > 0 && <Badge variant="secondary" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 p-0 text-[9px] text-white">{badgeCount > 99 ? '99+' : badgeCount}</Badge>}
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>
      </nav>
      <div className="flex w-full justify-center border-t border-slate-100 py-2">
        <SeasonalEffectsButton collapsed />
      </div>
    </motion.aside>
  );
}
