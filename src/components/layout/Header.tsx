import { useState, useMemo, useEffect } from 'react';
import { Search, Bell, User, Moon, Sun, ExternalLink, BarChart3, Briefcase, FileSpreadsheet, Construction, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { getCompanyLogoUrl } from '@/lib/companyLogo';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import { TeamHeaderButton } from '@/components/teams/TeamHeaderButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideNotifications?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onNavigateToSection?: (section: string) => void;
}

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

type SectionDef = {
  id: string;
  label: string;
  description: string;
  adminOnly?: boolean;
  mainAdminOnly?: boolean;
  supervisorOnly?: boolean;
  permission?: 'can_access_management' | 'can_post_announcements' | 'can_delete_messages' | 'can_access_password_change' | 'can_create_war_room';
};

const ALL_SECTIONS: SectionDef[] = [
  { id: 'home', label: 'Início', description: 'Visão geral do Nuvexa' },
  { id: 'chat', label: 'Chat por Setores', description: 'Comunicação entre equipes' },
  { id: 'announcements', label: 'Avisos Gerais', description: 'Comunicados oficiais' },
  { id: 'birthdays', label: 'Aniversariantes', description: 'Mural de celebrações' },
  { id: 'war-room', label: 'War Room', description: 'Gestão de incidentes críticos' },
  { id: 'tasks', label: 'Gestão de Tarefas', description: 'Quadro de atividades' },
  { id: 'people-management', label: 'Gestão de Pessoas', description: 'Equipe e relatórios', supervisorOnly: true },
  { id: 'management', label: 'Gerenciamento', description: 'Administração do sistema', permission: 'can_access_management' },
  { id: 'sectors', label: 'Gestão de Setores', description: 'Departamentos da empresa', adminOnly: true },
  { id: 'important-announcements', label: 'Comunicados Importantes', description: 'Avisos em destaque', adminOnly: true },
  { id: 'data-management', label: 'Exclusão de Dados', description: 'Gerenciamento de dados', adminOnly: true },
  { id: 'feedback-email', label: 'Disparo de Feedback', description: 'E-mails de feedback mensal', adminOnly: true },
  { id: 'my-dashboard', label: 'Meu Painel', description: 'Métricas pessoais' },
  { id: 'evaluations', label: 'Avaliações', description: 'Avaliação de desempenho' },
  { id: 'calendar', label: 'Calendário', description: 'Reuniões e prazos' },
  { id: 'system-logs', label: 'Logs do Sistema', description: 'Auditoria e relatórios', mainAdminOnly: true },
  { id: 'event-history', label: 'Eventos Mensais', description: 'Histórico de campanhas', adminOnly: true },
  { id: 'api-management', label: 'API Integração', description: 'Integrações externas', adminOnly: true },
  { id: 'storage', label: 'Armazenamento', description: 'Monitoramento do banco', mainAdminOnly: true },
  { id: 'documentation', label: 'Documentação', description: 'Documentação técnica', mainAdminOnly: true },
];

export function Header({ title, subtitle, hideNotifications = false, searchQuery = '', onSearchChange, onNavigateToSection }: HeaderProps) {
  const { counts } = useNotifications();
  const { profile, isAdmin, canAccess } = useAuth();
  const { company, hasModule } = useCompany();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSectionSearch, setShowSectionSearch] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.title = company?.name ? `${company.name} | Nuvexa` : 'Nuvexa - Comunicação Empresarial';
    const faviconUrl = getCompanyLogoUrl(company?.logo_url);
    document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach((link) => { link.href = faviconUrl ?? ''; });
  }, [company?.name, company?.logo_url]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const isMainAdmin = profile?.email === ADMIN_EMAIL;
  const autonomy = profile?.autonomy_level;

  const visibleSections = useMemo(() => {
    return ALL_SECTIONS.filter(s => {
      if (s.mainAdminOnly) return isAdmin && isMainAdmin;
      if (s.adminOnly) return isAdmin;
      if (s.supervisorOnly) {
        if (isAdmin) return true;
        return autonomy === 'supervisor' || autonomy === 'gerente' || autonomy === 'gestor' || autonomy === 'diretoria';
      }
      if (s.permission) {
        if (isAdmin) return true;
        if (autonomy === 'diretoria') return true;
        return canAccess(s.permission);
      }
      return true;
    });
  }, [isAdmin, isMainAdmin, autonomy, canAccess]);

  const filteredSections = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return visibleSections.filter(s => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [searchQuery, visibleSections]);

  const handleSelectSection = (sectionId: string) => {
    onNavigateToSection?.(sectionId);
    onSearchChange?.('');
    setShowSectionSearch(false);
  };

  const showBiButton = hasModule('bi');
  const showBhButton = hasModule('bh') && (isAdmin || canAccess('can_access_bh' as any));
  const showFechamentoButton = hasModule('fechamento') && (isAdmin || canAccess('can_access_fechamento' as any));
  const showOrbsButton = hasModule('orbs') && (isAdmin || canAccess('can_access_orbs' as any));
  const canCreateAnnouncement = isAdmin || canAccess('can_post_announcements');
  const isAnnouncementsPage = title === 'Avisos Gerais';

  const openNewAnnouncement = () => {
    window.dispatchEvent(new CustomEvent('nuvexa:open-new-announcement'));
  };

  return (
    <>
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-3 mt-3 flex h-16 items-center justify-between rounded-2xl border border-border/70 bg-card px-6 shadow-sm">
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          <div className="relative hidden md:block shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Busca de Abas..." value={searchQuery} onChange={(e) => { onSearchChange?.(e.target.value); setShowSectionSearch(true); }} onFocus={() => { if (searchQuery) setShowSectionSearch(true); }} onBlur={() => setTimeout(() => setShowSectionSearch(false), 200)} className="w-56 bg-muted/50 pl-10 focus-visible:ring-primary" />
            {showSectionSearch && filteredSections.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                {filteredSections.map(section => (
                  <button key={section.id} onMouseDown={(e) => { e.preventDefault(); handleSelectSection(section.id); }} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
                    <div><p className="text-sm font-medium text-foreground">{section.label}</p><p className="text-xs text-muted-foreground">{section.description}</p></div>
                  </button>
                ))}
              </div>
            )}
            {showSectionSearch && searchQuery && filteredSections.length === 0 && <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">Nenhuma aba encontrada</div>}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {isAnnouncementsPage && canCreateAnnouncement && (
              <Button onClick={openNewAnnouncement} size="sm" className="h-8 gap-1.5 rounded-lg px-3">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo Aviso</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            )}

            {showBiButton && <Button variant="outline" size="sm" className="hidden gap-1.5 lg:flex" asChild><a href="https://drive-data-ace.vercel.app/login" target="_blank" rel="noopener noreferrer"><BarChart3 className="h-4 w-4" />Dash BI</a></Button>}
            {showBhButton && <Button variant="outline" size="sm" className="hidden gap-1.5 lg:flex" asChild><a href="https://banco-de-horas-servchat.vercel.app/" target="_blank" rel="noopener noreferrer"><Briefcase className="h-4 w-4" />BH</a></Button>}
            {showFechamentoButton && <Button variant="outline" size="sm" className="hidden gap-1.5 lg:flex" onClick={() => setShowComingSoon('Fechamento')}><FileSpreadsheet className="h-4 w-4" />Fechamento</Button>}
            {showOrbsButton && <Button variant="outline" size="sm" className="hidden gap-1.5 md:flex" asChild><a href="https://sync-synergy-flow.vercel.app/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Orbs</a></Button>}

            <TeamHeaderButton />

            {!hideNotifications && (
              <Popover open={showNotifications} onOpenChange={setShowNotifications}>
                <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative"><Bell className="h-5 w-5" />{counts.total > 0 && <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-secondary p-0 text-xs">{counts.total > 99 ? '99+' : counts.total}</Badge>}</PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="border-b border-border p-4"><h3 className="font-semibold">Notificacoes</h3></div>
                  <ScrollArea className="h-64"><div className="space-y-3 p-4">
                    {counts.unreadMessages > 0 && <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"><div className="h-2 w-2 rounded-full bg-primary" /><div className="flex-1"><p className="text-sm font-medium">Mensagens nao lidas</p><p className="text-xs text-muted-foreground">{counts.unreadMessages} {counts.unreadMessages === 1 ? 'mensagem' : 'mensagens'}</p></div></div>}
                    {counts.unreadAnnouncements > 0 && <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"><div className="h-2 w-2 rounded-full bg-secondary" /><div className="flex-1"><p className="text-sm font-medium">Avisos nao lidos</p><p className="text-xs text-muted-foreground">{counts.unreadAnnouncements} {counts.unreadAnnouncements === 1 ? 'aviso' : 'avisos'}</p></div></div>}
                    {counts.total === 0 && <div className="py-8 text-center text-muted-foreground"><Bell className="mx-auto mb-2 h-8 w-8 opacity-50" /><p className="text-sm">Nenhuma notificacao</p></div>}
                  </div></ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            <Button variant="ghost" size="icon" onClick={toggleDarkMode} title={isDark ? 'Modo Claro' : 'Modo Noturno'}>{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
            <Button variant="ghost" size="icon" onClick={() => setShowProfile(true)}><User className="h-5 w-5" /></Button>
          </div>
        </div>
      </motion.header>

      <UserProfileDialog open={showProfile} onOpenChange={setShowProfile} />
      <Dialog open={showComingSoon !== null} onOpenChange={(open) => !open && setShowComingSoon(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Construction className="h-5 w-5 text-amber-500" />{showComingSoon}</DialogTitle><DialogDescription className="pt-2">Aguarde, em fase de Implantação.</DialogDescription></DialogHeader><div className="mb-3 flex flex-col items-center py-6 text-center"><div className="mb-3 rounded-full bg-amber-100 p-4 dark:bg-amber-900/30"><Construction className="h-10 w-10 text-amber-500" /></div><p className="max-w-sm text-sm text-muted-foreground">O módulo <strong>{showComingSoon}</strong> está sendo preparado e estará disponível em breve.</p></div></DialogContent>
      </Dialog>
    </>
  );
}
