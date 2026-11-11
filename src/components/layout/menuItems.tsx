import { IS_DEMO } from '@/lib/demo/bootDemo';
import { CreditCard, Plug, Mail, FileText, HardDrive, CalendarDays, BookOpen, Shield, Globe, ClipboardCheck, Megaphone, Link, MessageSquare, Bell, Home, Cake, Settings, Trash2, Building2, Sparkles, DoorOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { sectionLock } from '@/lib/planAccess';

const DEMO_HIDDEN_SECTIONS = new Set(['data-management', 'api-management', 'event-history']);
export const menuItems = [
  { id: 'home', icon: Home, label: 'Início' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'announcements', icon: Bell, label: 'Avisos' },
  { id: 'birthdays', icon: Cake, label: 'Aniversariantes' },
  { id: 'war-room', icon: Shield, label: 'War Room' },
  { id: 'meeting-rooms', icon: DoorOpen, label: 'Sala de Reunião', permission: 'can_access_meeting_rooms' as const },
  { id: 'management', icon: Settings, label: 'Gerenciamento', permission: 'can_access_management' as const },
  { id: 'shortcuts', icon: Link, label: 'Atalhos do Sistema', adminOnly: true },
  { id: 'companies', icon: Building2, label: 'Empresas', superAdminOnly: true },
  { id: 'system-broadcasts', icon: Megaphone, label: 'Comunicados Globais', superAdminOnly: true },
  { id: 'sectors', icon: Building2, label: 'Gestão de Setores', adminOnly: true },
  { id: 'data-management', icon: Trash2, label: 'Exclusão de Dados', adminOnly: true },
  { id: 'feedback-email', icon: Mail, label: 'Disparo de Feedback', adminOnly: true },
  { id: 'evaluations', icon: ClipboardCheck, label: 'Avaliações' },
  { id: 'calendar', icon: CalendarDays, label: 'Calendário' },
  { id: 'system-logs', icon: FileText, label: 'Logs do Sistema', mainAdminOnly: true },
  { id: 'event-history', icon: Sparkles, label: 'Eventos Mensais', adminOnly: true },
  { id: 'api-management', icon: Globe, label: 'API Integração', adminOnly: true },
  { id: 'storage', icon: HardDrive, label: 'Armazenamento', superAdminOnly: true },
  { id: 'documentation', icon: BookOpen, label: 'Documentação', mainAdminOnly: true },
  { id: 'integrations', icon: Plug, label: 'Integrações', adminOnly: true },
  { id: 'billing', icon: CreditCard, label: 'Pagamentos', billingOnly: true },
];

// Same list/permissions the side menu shows for the current user.
export function useVisibleMenuItems() {
  const { profile, isAdmin, canAccess, roles } = useAuth();
  const isSuperAdmin = roles.some((r: any) => (r.role as string) === 'super_admin');
  const { plan } = useCompanyPlan();
  const visibleMenuItems = menuItems.filter(item => {
    if (IS_DEMO && DEMO_HIDDEN_SECTIONS.has(item.id)) return false;
    // Plan: system tabs only for the platform owner; features the plan does not include stay hidden.
    if (sectionLock(item.id, plan, isSuperAdmin)) return false;
    if ('billingOnly' in item && item.billingOnly) return isAdmin && !!plan && !plan.is_system && plan.status !== 'exempt';
    if ('superAdminOnly' in item && item.superAdminOnly) return isSuperAdmin;
    if ('mainAdminOnly' in item && item.mainAdminOnly) return isAdmin && profile?.email === 'adminservchat@servsul.com.br';
    if ('adminOnly' in item && item.adminOnly) return isAdmin;
    if ('permission' in item) {
      if (isAdmin || profile?.autonomy_level === 'diretoria') return true;
      return canAccess(item.permission);
    }
    return true;
  });
  return visibleMenuItems;
}
