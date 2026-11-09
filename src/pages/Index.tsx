import { useState, useEffect, useMemo, Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyRetry';
import { SectionBoundary } from '@/components/common/SectionBoundary';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, LayoutDashboard, MessageSquare, Bell, Cake, Settings, Link as LinkIcon, ScanFace, Trash2, Building2, Sparkles, ListTodo, UsersRound, Mail, CalendarDays, FileText, HardDrive, BookOpen, Shield, Globe, ClipboardCheck, StickyNote, Megaphone, Plug, LayoutGrid, CreditCard, Lock } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePresence } from '@/hooks/usePresence';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useBirthdayCelebration } from '@/hooks/useBirthdayCelebration';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { sectionLock, FEATURE_LABEL, SECTION_FEATURE } from '@/lib/planAccess';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { EwwonLoader, EwwonLogo } from '@/components/common/EwwonLoader';
const EwwonApp = lazyWithRetry(() => import('@/components/ewwon/EwwonApp'));
const HomeSection = lazyWithRetry(() => import('@/components/sections/HomeSection').then((module) => ({ default: module.HomeSection })));
const ChatSection = lazyWithRetry(() => import('@/components/sections/ChatSection').then((module) => ({ default: module.ChatSection })));
const AnnouncementsSection = lazyWithRetry(() => import('@/components/sections/AnnouncementsSection').then((module) => ({ default: module.AnnouncementsSection })));
const BirthdaysSection = lazyWithRetry(() => import('@/components/sections/BirthdaysSection').then((module) => ({ default: module.BirthdaysSection })));
const MyDashboardSection = lazyWithRetry(() => import('@/components/sections/MyDashboardSection').then((module) => ({ default: module.MyDashboardSection })));
const ManagementSection = lazyWithRetry(() => import('@/components/sections/ManagementSection').then((module) => ({ default: module.ManagementSection })));
const FacialRegistrationSection = lazyWithRetry(() => import('@/components/sections/FacialRegistrationSection').then((module) => ({ default: module.FacialRegistrationSection })));
const DataManagementSection = lazyWithRetry(() => import('@/components/sections/DataManagementSection').then((module) => ({ default: module.DataManagementSection })));
const SectorManagementSection = lazyWithRetry(() => import('@/components/sections/SectorManagementSection').then((module) => ({ default: module.SectorManagementSection })));
const TaskBoardSection = lazyWithRetry(() => import('@/components/sections/TaskBoardSection').then((module) => ({ default: module.TaskBoardSection })));
const PeopleManagementSection = lazyWithRetry(() => import('@/components/sections/PeopleManagementSection').then((module) => ({ default: module.PeopleManagementSection })));
const FeedbackEmailSection = lazyWithRetry(() => import('@/components/sections/FeedbackEmailSection').then((module) => ({ default: module.FeedbackEmailSection })));
const LogsSection = lazyWithRetry(() => import('@/components/sections/LogsSection').then((module) => ({ default: module.LogsSection })));
const StorageMonitoringSection = lazyWithRetry(() => import('@/components/sections/StorageMonitoringSection').then((module) => ({ default: module.StorageMonitoringSection })));
const EventHistorySection = lazyWithRetry(() => import('@/components/sections/EventHistorySection').then((module) => ({ default: module.EventHistorySection })));
const CalendarSection = lazyWithRetry(() => import('@/components/sections/CalendarSection').then((module) => ({ default: module.CalendarSection })));
const DocumentationSection = lazyWithRetry(() => import('@/components/sections/DocumentationSection').then((module) => ({ default: module.DocumentationSection })));
const ApiManagementSection = lazyWithRetry(() => import('@/components/sections/ApiManagementSection').then((module) => ({ default: module.ApiManagementSection })));
const WarRoomSection = lazyWithRetry(() => import('@/components/sections/WarRoomSection').then((module) => ({ default: module.WarRoomSection })));
const MeetingRoomsSection = lazyWithRetry(() => import('@/components/sections/MeetingRoomsSection').then((module) => ({ default: module.MeetingRoomsSection })));
const EvaluationsSection = lazyWithRetry(() => import('@/components/sections/EvaluationsSection').then((module) => ({ default: module.EvaluationsSection })));
const NotesSection = lazyWithRetry(() => import('@/components/sections/NotesSection').then((module) => ({ default: module.NotesSection })));
const CompaniesManagementSection = lazyWithRetry(() => import('@/components/sections/CompaniesManagementSection').then((module) => ({ default: module.CompaniesManagementSection })));
const SystemBroadcastsSection = lazyWithRetry(() => import('@/components/sections/SystemBroadcastsSection').then((module) => ({ default: module.SystemBroadcastsSection })));
const Dashboard3DSection = lazyWithRetry(() => import('@/components/sections/Dashboard3DSection').then((module) => ({ default: module.Dashboard3DSection })));
const IntegrationsSection = lazyWithRetry(() => import('@/components/sections/IntegrationsSection').then((module) => ({ default: module.IntegrationsSection })));
const BillingSection = lazyWithRetry(() => import('@/components/sections/BillingSection').then((module) => ({ default: module.BillingSection })));
const ShortcutsManagementSection = lazyWithRetry(() => import('@/components/sections/ShortcutsManagementSection').then((module) => ({ default: module.ShortcutsManagementSection })));
import { SystemBroadcastBanner } from '@/components/layout/SystemBroadcastBanner';
import { GlobalBroadcastOrb } from '@/components/common/GlobalBroadcastOrb';
import { FloatingNoteWindow } from '@/components/notes/FloatingNoteWindow';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { BirthdayCelebrationModal } from '@/components/birthday/BirthdayCelebrationModal';
import { BoardJoinDialog } from '@/components/tasks/BoardJoinDialog';
import { useWarRoomAlarm } from '@/hooks/useWarRoomAlarm';
import { WarRoomAlarmOverlay } from '@/components/warroom/WarRoomAlarmOverlay';

const sectionTitles: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Início', subtitle: 'Visão geral do ewvon' },
  'my-dashboard': { title: 'Meu Painel', subtitle: 'Métricas e estatísticas personalizadas' },
  chat: { title: 'Chat por Setores', subtitle: 'Comunicação entre equipes' },
  announcements: { title: 'Avisos Gerais', subtitle: 'Comunicados oficiais' },
  birthdays: { title: 'Aniversariantes', subtitle: 'Mural de celebrações' },
  management: { title: 'Gerenciamento', subtitle: 'Administração do sistema' },
  shortcuts: { title: 'Atalhos do Sistema', subtitle: 'Links personalizados do cabeçalho do PC' },
  facial: { title: 'Cadastro Facial', subtitle: 'Reconhecimento biométrico' },
  'data-management': { title: 'Exclusão de Dados', subtitle: 'Gerenciamento de dados do sistema' },
  sectors: { title: 'Gestão de Setores', subtitle: 'Departamentos da empresa' },
  tasks: { title: 'Gestão de Tarefas', subtitle: 'Quadro de atividades' },
  'people-management': { title: 'Gestão de Pessoas', subtitle: 'Equipe e relatórios' },
  'feedback-email': { title: 'Disparo de Feedback', subtitle: 'E-mails de feedback mensal' },
  calendar: { title: 'Calendário', subtitle: 'Reuniões, lembretes e prazos' },
  'system-logs': { title: 'Logs do Sistema', subtitle: 'Auditoria e relatórios' },
  storage: { title: 'Armazenamento', subtitle: 'Monitoramento do banco de dados' },
  'event-history': { title: 'Eventos Mensais', subtitle: 'Histórico de campanhas' },
  documentation: { title: 'Documentação', subtitle: 'Documentação técnica do sistema' },
  'war-room': { title: 'War Room', subtitle: 'Gestão de incidentes críticos' },
  'meeting-rooms': { title: 'Sala de Reunião', subtitle: 'Agendamento e disponibilidade de salas' },
  'api-management': { title: 'API de Integração', subtitle: 'Gerenciamento de integrações externas' },
  evaluations: { title: 'Avaliações', subtitle: 'Avaliação de desempenho e feedback' },
  notes: { title: 'Anotações', subtitle: 'Suas notas pessoais e compartilhadas' },
  companies: { title: 'Empresas', subtitle: 'Gestão de tenants do sistema' },
  'system-broadcasts': { title: 'Comunicados Globais', subtitle: 'Avisos para todas as empresas' },
  billing: { title: 'Pagamentos', subtitle: 'Plano, cobranças e extras da empresa' },
  'dashboard-3d': { title: 'Dash', subtitle: 'Exclusivo do plano Empresarial' },
  integrations: { title: 'Integrações', subtitle: 'Slack, Teams, WhatsApp e Google' },
};

const sectionPaths: Record<string, string> = {
  home: '/', 'my-dashboard': '/meu-painel', chat: '/chat', announcements: '/avisos',
  birthdays: '/aniversariantes', management: '/gerenciamento', shortcuts: '/atalhos',
  facial: '/cadastro-facial', 'data-management': '/gestao-de-dados', sectors: '/setores',
  tasks: '/tarefas',
  'people-management': '/gestao-de-pessoas', 'feedback-email': '/disparo-de-feedback',
  calendar: '/calendario', 'system-logs': '/logs-do-sistema', storage: '/armazenamento',
  'event-history': '/eventos-mensais', documentation: '/documentacao', 'war-room': '/war-room',
  'api-management': '/integracoes-api', evaluations: '/avaliacoes', notes: '/anotacoes',
  companies: '/empresas', 'system-broadcasts': '/comunicados-globais', 'meeting-rooms': '/salas-de-reuniao',
  billing: '/pagamentos',
  'dashboard-3d': '/dash',
  integrations: '/integracoes',
};
const pathSections = Object.fromEntries(Object.entries(sectionPaths).map(([key, path]) => [path, key])) as Record<string, string>;


const sectionIntroIcons = {
  home: Home, 'my-dashboard': LayoutDashboard, chat: MessageSquare,
  announcements: Bell, birthdays: Cake, management: Settings, shortcuts: LinkIcon,
  facial: ScanFace, 'data-management': Trash2, sectors: Building2,
  tasks: ListTodo, 'people-management': UsersRound,
  'feedback-email': Mail, calendar: CalendarDays, 'system-logs': FileText,
  storage: HardDrive, documentation: BookOpen, 'war-room': Shield,
  'api-management': Plug, evaluations: ClipboardCheck, notes: StickyNote,
  companies: Building2, 'system-broadcasts': Megaphone, 'event-history': Sparkles, billing: CreditCard, 'dashboard-3d': LayoutDashboard, integrations: Plug,
} as const;

function LockedSection({ reason, feature, onBilling, onHome }: { reason: 'system' | 'plan'; feature: string; onBilling?: () => void; onHome: () => void }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Lock className="h-5 w-5" /></div>
        <h2 className="text-lg font-semibold text-foreground">{reason === 'system' ? 'Área exclusiva da administração do ewvon' : 'Recurso não incluído no seu plano'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{reason === 'system' ? 'Esta aba gerencia a plataforma inteira e não está disponível para empresas clientes.' : `${feature || 'Este recurso'} está disponível em planos superiores. ${onBilling ? 'Para liberar, fale com a equipe ewvon e mude de plano.' : 'Fale com o administrador da sua empresa para mudar de plano.'}`}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={onHome} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">Voltar ao início</button>
          {reason === 'plan' && onBilling && <button type="button" onClick={onBilling} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">Ver meu plano</button>}
        </div>
      </div>
    </div>
  );
}

function SectionTransitionIndicator({ section }: { section: string }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'dot' | 'expanded' | 'glow' | 'collapse'>('dot');
  const title = sectionTitles[section]?.title || 'Início';
  const Icon = sectionIntroIcons[section as keyof typeof sectionIntroIcons] || LayoutGrid;

  useEffect(() => {
    setVisible(false);
    setPhase('dot');
    if (section === 'calendar') return;

    // Sequência: bolinha aparece, pausa, abre, destaca com sombra, fecha e some.
    const showTimer = window.setTimeout(() => setVisible(true), 30);
    const expandTimer = window.setTimeout(() => setPhase('expanded'), 1050);
    const glowTimer = window.setTimeout(() => setPhase('glow'), 2050);
    const collapseTimer = window.setTimeout(() => setPhase('collapse'), 3150);
    const hideTimer = window.setTimeout(() => setVisible(false), 3650);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(expandTimer);
      window.clearTimeout(glowTimer);
      window.clearTimeout(collapseTimer);
      window.clearTimeout(hideTimer);
    };
  }, [section]);

  if (section === 'calendar') return null;
  const isExpanded = phase === 'expanded' || phase === 'glow';
  const pillWidth = Math.min(310, Math.max(154, title.length * 8 + 76));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center" aria-live="polite">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={section}
            initial={{ opacity: 0, scale: 0.55, filter: 'blur(5px)', width: 44 }}
            animate={{
              opacity: phase === 'collapse' ? 0.92 : 1,
              scale: phase === 'collapse' ? 0.96 : 1,
              filter: 'blur(0px)',
              width: isExpanded ? pillWidth : 44,
              boxShadow: phase === 'glow'
                ? '0 0 0 1px rgba(255,255,255,0.95), 0 0 0 5px rgba(148,163,184,0.18), 0 0 22px rgba(255,255,255,0.75), 0 18px 48px rgba(15,23,42,0.30)'
                : '0 8px 24px rgba(15,23,42,0.12)',
            }}
            exit={{ opacity: 0, scale: 0.62, filter: 'blur(7px)', transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } }}
            transition={{
              opacity: { duration: phase === 'collapse' ? 0.28 : 0.24 },
              scale: { type: 'spring', stiffness: 360, damping: 27 },
              filter: { duration: 0.24 },
              width: { type: 'spring', stiffness: 300, damping: 28 },
              boxShadow: { duration: 0.42, ease: 'easeOut' },
            }}
            className="flex h-11 items-center overflow-hidden rounded-full border border-white/70 bg-white/90 px-1.5 text-slate-900 backdrop-blur-2xl"
            role="status"
            aria-label={title}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
              <Icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <motion.span
              initial={false}
              animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -5 }}
              transition={{ duration: 0.2, delay: isExpanded ? 0.08 : 0 }}
              className="min-w-0 flex-1 truncate px-3 text-[13px] font-semibold tracking-[-0.02em]"
            >
              {title}
            </motion.span>
            <motion.span
              animate={{ opacity: isExpanded ? 0.7 : 0, scale: isExpanded ? 1 : 0.7 }}
              transition={{ duration: 0.18 }}
              className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(() => pathSections[location.pathname] || 'home');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const joinToken = searchParams.get('join');

  useEffect(() => {
    const pathSection = pathSections[location.pathname] || (location.pathname.startsWith('/tarefas/') ? 'tasks' : undefined);
    const legacySection = searchParams.get('section');
    if (pathSection) {
      setActiveSection(pathSection);
    } else if (legacySection && legacySection in sectionTitles) {
      setActiveSection(legacySection);
      navigate(sectionPaths[legacySection], { replace: true });
    } else {
      setActiveSection('home');
    }
  }, [location.pathname, searchParams, navigate]);

  const handleSectionChange = (section: string) => {
    const destination = sectionPaths[section] || '/';
    const next = new URLSearchParams(searchParams);
    next.delete('section');
    next.delete('board');
    next.delete('task');
    const query = next.toString();
    navigate(query ? `${destination}?${query}` : destination);
    setActiveSection(section);
  };
  const handleCloseJoinDialog = () => { searchParams.delete('join'); setSearchParams(searchParams, { replace: true }); };
  const handleNavigateToTasks = () => handleSectionChange('tasks');
  const isMobile = useIsMobile(); const [isReady, setIsReady] = useState(false); const { profile, isAdmin, roles } = useAuth();
  const { plan: companyPlan, loading: planLoading } = useCompanyPlan(); const isSuperAdminUser = roles.some((r: any) => (r.role as string) === 'super_admin');
  const { showOnboarding, completeOnboarding } = useOnboarding(); const { showCelebration, closeCelebration, userName } = useBirthdayCelebration(); const { isAlarming, pendingWarRoomId, dismissAlarm } = useWarRoomAlarm();
  const handleOpenWarRoom = () => { handleSectionChange('war-room'); dismissAlarm(); };
  usePresence(); useMeetingStatus();
  useEffect(() => { const timer = requestAnimationFrame(() => setIsReady(true)); return () => cancelAnimationFrame(timer); }, []);
  const handleNavigateToChat = () => handleSectionChange('chat'); const handleNavigateToAnnouncements = () => handleSectionChange('announcements');
  const handleRegisterFacial = () => { completeOnboarding(); handleSectionChange('facial'); };

  if (showOnboarding && profile && !isMobile) return <OnboardingScreen userName={profile.display_name || profile.name} onComplete={completeOnboarding} onRegisterFacial={handleRegisterFacial} />;
  if (!isReady) return <EwwonLoader />;

  const renderSection = () => {
    const lock = sectionLock(activeSection, companyPlan, isSuperAdminUser);
    if (lock === 'system' && planLoading) return null;
    if (lock) return <LockedSection reason={lock} feature={FEATURE_LABEL[SECTION_FEATURE[activeSection]] || ''} onBilling={isAdmin ? () => handleSectionChange('billing') : undefined} onHome={() => handleSectionChange('home')} />;
    switch (activeSection) {
      case 'home': return <HomeSection onNavigate={handleSectionChange} />;
      case 'my-dashboard': return <MyDashboardSection />;
      case 'chat': return <ChatSection globalSearch={globalSearch} />;
      case 'announcements': return <AnnouncementsSection />;
      case 'birthdays': return <BirthdaysSection />;
      case 'management': return <ManagementSection />;
      case 'shortcuts': return isAdmin ? <ShortcutsManagementSection /> : <HomeSection onNavigate={handleSectionChange} />;
      case 'facial': return <FacialRegistrationSection />;
      case 'data-management': return <DataManagementSection />;
      case 'sectors': return <SectorManagementSection />;
      case 'tasks': return <TaskBoardSection />;
      case 'people-management': return <PeopleManagementSection />;
      case 'feedback-email': return <FeedbackEmailSection />;
      case 'calendar': return <CalendarSection />;
      case 'system-logs': return <LogsSection />;
      case 'storage': return <StorageMonitoringSection />;
      case 'event-history': return <EventHistorySection />;
      case 'documentation': return <DocumentationSection />;
      case 'war-room': return <WarRoomSection />;
      case 'meeting-rooms': return <MeetingRoomsSection />;
      case 'api-management': return <ApiManagementSection />;
      case 'evaluations': return <EvaluationsSection />;
      case 'notes': return <NotesSection />;
      case 'companies': return <CompaniesManagementSection />;
      case 'system-broadcasts': return <SystemBroadcastsSection />;
      case 'dashboard-3d': return <Dashboard3DSection />;
      case 'integrations': return <IntegrationsSection />;
      case 'billing': return isAdmin ? <BillingSection /> : <HomeSection onNavigate={handleSectionChange} />;
      default: return <HomeSection onNavigate={setActiveSection} />;
    }
  };

  // An open task board keeps its own presentation (no professional flattening or page padding).
  const boardOpen = activeSection === 'tasks' && /^\/tarefas\/.+/.test(location.pathname);
  const currentSection = sectionTitles[activeSection] || sectionTitles.home; const isHomePage = activeSection === 'home';
  if (isMobile) {
    // Phones get the Ewwon mobile app (src/components/ewwon); desktop keeps the full workspace below.
    return <><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><Suspense fallback={<EwwonLoader />}><EwwonApp /></Suspense><BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} /><BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /></>;
  }
  return <div className="flex h-screen overflow-hidden bg-background"><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} /><div className="flex flex-1 flex-col overflow-hidden"><Header title={currentSection.title} subtitle={currentSection.subtitle} activeSection={activeSection} searchQuery={globalSearch} onSearchChange={setGlobalSearch} onNavigateToSection={handleSectionChange} /><main data-section={activeSection} className={`ewvon-main min-w-0 flex-1 overflow-auto bg-card ${['chat', 'calendar', 'tasks', 'war-room'].includes(activeSection) ? '' : 'clean-section'} ${['home', 'chat'].includes(activeSection) || boardOpen ? '' : 'pro-section'}`}><SectionBoundary resetKey={activeSection}><Suspense fallback={<div className="ewvon-section-loading flex h-full min-h-[60vh] items-center justify-center text-foreground" role="status" aria-label="Carregando seção"><EwwonLogo size={76} /></div>}>{renderSection()}</Suspense></SectionBoundary></main></div><InstallPrompt /><ChatbotWidget isHomePage={isHomePage} />{isHomePage && <GlobalBroadcastOrb />}<BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} /><BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /><FloatingNoteWindow /></div>;
};
export default Index;
