import { useState, useMemo, useEffect } from 'react';
import { Search, Bell, ExternalLink, BarChart3, Briefcase, FileSpreadsheet, Construction, Plus, Palette, LayoutDashboard, StickyNote, ListTodo, UsersRound, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCompanyLogoUrl } from '@/lib/companyLogo';
import { createCompanyLogoUrl } from '@/lib/companyLogo';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import { AppearancePersonalizationDialog } from '@/components/layout/AppearancePersonalizationDialog';
import { TeamHeaderButton } from '@/components/teams/TeamHeaderButton';
import { SystemShortcutBar } from '@/components/layout/SystemShortcutBar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HeaderProps { title: string; subtitle?: string; activeSection?: string; hideNotifications?: boolean; searchQuery?: string; onSearchChange?: (query: string) => void; onNavigateToSection?: (section: string) => void; }
const ADMIN_EMAIL = 'adminservchat@servsul.com.br';
type SectionDef = { id: string; label: string; description: string; adminOnly?: boolean; mainAdminOnly?: boolean; supervisorOnly?: boolean; permission?: 'can_access_management' | 'can_post_announcements' | 'can_delete_messages' | 'can_access_password_change' | 'can_create_war_room'; };
const ALL_SECTIONS: SectionDef[] = [
  { id: 'home', label: 'Início', description: 'Visão geral do ewvon' }, { id: 'chat', label: 'Chat por Setores', description: 'Comunicação entre equipes' }, { id: 'announcements', label: 'Avisos Gerais', description: 'Comunicados oficiais' }, { id: 'birthdays', label: 'Aniversariantes', description: 'Mural de celebrações' }, { id: 'war-room', label: 'War Room', description: 'Gestão de incidentes críticos' }, { id: 'tasks', label: 'Gestão de Tarefas', description: 'Quadro de atividades' }, { id: 'people-management', label: 'Gestão de Pessoas', description: 'Equipe e relatórios', supervisorOnly: true }, { id: 'management', label: 'Gerenciamento', description: 'Administração do sistema', permission: 'can_access_management' }, { id: 'shortcuts', label: 'Atalhos do Sistema', description: 'Links personalizados do cabeçalho', adminOnly: true }, { id: 'sectors', label: 'Gestão de Setores', description: 'Departamentos da empresa', adminOnly: true }, { id: 'important-announcements', label: 'Comunicados Importantes', description: 'Avisos em destaque', adminOnly: true }, { id: 'data-management', label: 'Exclusão de Dados', description: 'Gerenciamento de dados', adminOnly: true }, { id: 'feedback-email', label: 'Disparo de Feedback', description: 'E-mails de feedback mensal', adminOnly: true }, { id: 'my-dashboard', label: 'Meu Painel', description: 'Métricas pessoais' }, { id: 'evaluations', label: 'Avaliações', description: 'Avaliação de desempenho' }, { id: 'notes', label: 'Anotações', description: 'Suas notas pessoais e compartilhadas' }, { id: 'calendar', label: 'Calendário', description: 'Reuniões e prazos' }, { id: 'system-logs', label: 'Logs do Sistema', description: 'Auditoria e relatórios', mainAdminOnly: true }, { id: 'event-history', label: 'Eventos Mensais', description: 'Histórico de campanhas', adminOnly: true }, { id: 'api-management', label: 'API Integração', description: 'Integrações externas', adminOnly: true }, { id: 'storage', label: 'Armazenamento', description: 'Monitoramento do banco', mainAdminOnly: true }, { id: 'documentation', label: 'Documentação', description: 'Documentação técnica', mainAdminOnly: true },
];

export function Header({ title, subtitle, activeSection = 'home', hideNotifications = false, searchQuery = '', onSearchChange, onNavigateToSection }: HeaderProps) {
  const { counts } = useNotifications(); const { profile, isAdmin, canAccess, signOut } = useAuth(); const { company, hasModule } = useCompany();
  const companyLogoUrl = useCompanyLogoUrl(company?.logo_url);
  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const initials = displayName.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const [showNotifications, setShowNotifications] = useState(false); const [showProfile, setShowProfile] = useState(false); const [showSectionSearch, setShowSectionSearch] = useState(false); const [showComingSoon, setShowComingSoon] = useState<string | null>(null); const [showAppearance, setShowAppearance] = useState(false);
  useEffect(() => { document.title = company?.name ? `${company.name} | ewvon` : 'ewvon - Gestão de operações'; void createCompanyLogoUrl(company?.logo_url).then(faviconUrl => { if (!faviconUrl) return; document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(link => { link.href = faviconUrl; }); }); }, [company?.name, company?.logo_url]);
  const isMainAdmin = profile?.email === ADMIN_EMAIL; const autonomy = profile?.autonomy_level;
  const visibleSections = useMemo(() => ALL_SECTIONS.filter(s => { if (s.mainAdminOnly) return isAdmin && isMainAdmin; if (s.adminOnly) return isAdmin; if (s.supervisorOnly) return isAdmin || ['supervisor','gerente','gestor','diretoria'].includes(autonomy || ''); if (s.permission) return isAdmin || autonomy === 'diretoria' || canAccess(s.permission); return true; }), [isAdmin, isMainAdmin, autonomy, canAccess]);
  const filteredSections = useMemo(() => { if (!searchQuery) return []; const q = searchQuery.toLowerCase(); return visibleSections.filter(s => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)); }, [searchQuery, visibleSections]);
  const selectSection = (id: string) => { onNavigateToSection?.(id); onSearchChange?.(''); setShowSectionSearch(false); };
  const showBiButton = hasModule('bi'); const showBhButton = hasModule('bh') && (isAdmin || canAccess('can_access_bh' as any)); const showFechamentoButton = hasModule('fechamento') && (isAdmin || canAccess('can_access_fechamento' as any)); const showOrbsButton = hasModule('orbs') && (isAdmin || canAccess('can_access_orbs' as any)); const canCreateAnnouncement = isAdmin || canAccess('can_post_announcements');
  const openNewAnnouncement = () => window.dispatchEvent(new CustomEvent('ewvor:open-new-announcement'));
  return (<>
    <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      className="ewvon-topbar sticky top-0 z-30 flex min-h-[68px] items-center border-b border-slate-100/80 bg-white/95 px-5 shadow-none backdrop-blur-sm">
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <button type="button" onClick={() => onNavigateToSection?.('home')} className="ewvon-brand flex min-w-0 shrink-0 items-center gap-2.5 rounded-full border border-slate-100/90 bg-slate-50/70 py-1 pl-1.5 pr-3 text-left transition-colors hover:bg-slate-100/80" aria-label="Ir para o início">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-orange-100 bg-orange-50">
            {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-sm font-bold text-orange-600">{(company?.name || 'e').charAt(0).toUpperCase()}</span>}
          </span>
          <span className="max-w-36 truncate text-[14px] font-semibold tracking-tight text-slate-900">{company?.name || 'ewvon'}</span>
        </button>

        <nav className="ewvon-quick-nav flex min-w-0 items-center justify-start gap-1 overflow-x-auto px-2" aria-label="Atalhos principais">
          {([
            { id: 'my-dashboard', label: 'Meu Painel', Icon: LayoutDashboard },
            { id: 'notes', label: 'Anotações', Icon: StickyNote },
            { id: 'tasks', label: 'Tarefas', Icon: ListTodo },
            { id: 'people-management', label: 'Gestão de Pessoas', Icon: UsersRound },
          ] as const).filter(item => visibleSections.some(section => section.id === item.id)).map(item => (
            <button key={item.id} type="button" onClick={() => onNavigateToSection?.(item.id)}
              aria-label={item.label} title={item.label} aria-current={activeSection === item.id ? 'page' : undefined}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${activeSection === item.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
              <item.Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          ))}
        </nav>

        <div className="ewvon-actions flex shrink-0 items-center justify-end gap-1.5">
          <div className="relative">
            <button type="button" onClick={() => { setShowSectionSearch(value => !value); if (showSectionSearch) onSearchChange?.(''); }}
              title="Pesquisar abas" aria-label="Pesquisar abas"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
              <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
            {showSectionSearch && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
              <Input autoFocus placeholder="Buscar uma tela..." value={searchQuery}
                onChange={event => onSearchChange?.(event.target.value)}
                className="h-10 rounded-full border-slate-200 bg-slate-50 px-4 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-slate-300" />
              <div className="mt-2 max-h-72 overflow-y-auto">
                {filteredSections.length ? filteredSections.map(section => (
                  <button key={section.id} onMouseDown={event => { event.preventDefault(); selectSection(section.id); }}
                    className="flex w-full items-start rounded-xl px-3 py-2.5 text-left hover:bg-slate-50">
                    <div><p className="text-sm font-medium text-slate-800">{section.label}</p><p className="text-xs text-slate-400">{section.description}</p></div>
                  </button>
                )) : searchQuery ? <div className="p-4 text-center text-sm text-slate-500">Nenhuma aba encontrada</div> : <p className="p-3 text-xs text-slate-400">Digite para encontrar uma tela.</p>}
              </div>
            </div>}
          </div>
          {title === 'Avisos Gerais' && canCreateAnnouncement && <Button onClick={openNewAnnouncement} size="sm" className="h-9 gap-1.5 rounded-full px-3"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo Aviso</span></Button>}
          {title === 'Início' && <SystemShortcutBar onManage={() => onNavigateToSection?.('shortcuts')} />}
          {showBiButton && <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-full lg:flex" asChild><a href="https://drive-data-ace.vercel.app/login" target="_blank" rel="noopener noreferrer"><BarChart3 className="h-4 w-4" />Dash BI</a></Button>}
          {showBhButton && <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-full lg:flex" asChild><a href="https://banco-de-horas-servchat.vercel.app/" target="_blank" rel="noopener noreferrer"><Briefcase className="h-4 w-4" />BH</a></Button>}
          {showFechamentoButton && <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-full lg:flex" onClick={() => setShowComingSoon('Fechamento')}><FileSpreadsheet className="h-4 w-4" />Fechamento</Button>}
          {showOrbsButton && <Button variant="outline" size="sm" className="hidden gap-1.5 rounded-full md:flex" asChild><a href="https://sync-synergy-flow.vercel.app/" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Orbs</a></Button>}
          <TeamHeaderButton />
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setShowAppearance(true)} title="Personalizar visual"><Palette className="h-[18px] w-[18px]" /></Button>
          {!hideNotifications && <Popover open={showNotifications} onOpenChange={setShowNotifications}>
            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100" title="Notificações"><Bell className="h-[18px] w-[18px]" />{counts.total > 0 && <Badge className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 p-0 text-[9px] text-white">{counts.total > 99 ? '99+' : counts.total}</Badge>}</Button></PopoverTrigger>
            <PopoverContent className="w-80 rounded-2xl p-0" align="end"><div className="border-b border-border p-4"><h3 className="font-semibold">Notificações</h3></div><ScrollArea className="h-64"><div className="space-y-3 p-4">{counts.unreadMessages > 0 && <div className="rounded-xl bg-muted/50 p-3 text-sm">{counts.unreadMessages} mensagens não lidas</div>}{counts.unreadAnnouncements > 0 && <div className="rounded-xl bg-muted/50 p-3 text-sm">{counts.unreadAnnouncements} avisos não lidos</div>}{counts.total === 0 && <div className="py-8 text-center text-muted-foreground"><Bell className="mx-auto mb-2 h-8 w-8 opacity-50" /><p className="text-sm">Nenhuma notificação</p></div>}</div></ScrollArea></PopoverContent>
          </Popover>}
          <button type="button" onClick={() => setShowProfile(true)} className="ml-1 flex h-10 items-center gap-2 rounded-full border border-slate-100 bg-white py-1 pl-1 pr-3 transition-colors hover:bg-slate-50" title="Perfil do usuário">
            <Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url || ''} alt={displayName} className="object-cover" /><AvatarFallback className="bg-slate-900 text-[11px] font-semibold text-white">{initials}</AvatarFallback></Avatar>
            <span className="hidden max-w-28 flex-col items-start leading-tight sm:flex"><span className="max-w-28 truncate text-[12px] font-semibold text-slate-800">{displayName}</span><span className="text-[10px] text-slate-400">{profile?.autonomy_level || 'Usuário'}</span></span>
          </button>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair" className="h-9 w-9 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-900"><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>
    </motion.header>
    <AppearancePersonalizationDialog open={showAppearance} onOpenChange={setShowAppearance} />
    <UserProfileDialog open={showProfile} onOpenChange={setShowProfile} />
    <Dialog open={showComingSoon !== null} onOpenChange={open => !open && setShowComingSoon(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Construction className="h-5 w-5 text-amber-500" />{showComingSoon}</DialogTitle><DialogDescription className="pt-2">Aguarde, em fase de Implantação.</DialogDescription></DialogHeader><div className="flex flex-col items-center py-6 text-center"><Construction className="mb-3 h-10 w-10 text-amber-500" /><p className="text-sm text-muted-foreground">O módulo <strong>{showComingSoon}</strong> está sendo preparado e estará disponível em breve.</p></div></DialogContent></Dialog>
  </>);
}
