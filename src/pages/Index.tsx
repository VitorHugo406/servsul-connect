import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, LayoutDashboard, MessageSquare, Bell, Cake, Settings, Link as LinkIcon, ScanFace, Trash2, Building2, Sparkles, ListTodo, UsersRound, Mail, CalendarDays, FileText, HardDrive, BookOpen, Shield, Globe, ClipboardCheck, StickyNote, Megaphone, Plug, LayoutGrid } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePresence } from '@/hooks/usePresence';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useBirthdayCelebration } from '@/hooks/useBirthdayCelebration';
import { useImportantAnnouncements } from '@/hooks/useImportantAnnouncements';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
const HomeSection = lazy(() => import('@/components/sections/HomeSection').then((module) => ({ default: module.HomeSection })));
const ChatSection = lazy(() => import('@/components/sections/ChatSection').then((module) => ({ default: module.ChatSection })));
const AnnouncementsSection = lazy(() => import('@/components/sections/AnnouncementsSection').then((module) => ({ default: module.AnnouncementsSection })));
const BirthdaysSection = lazy(() => import('@/components/sections/BirthdaysSection').then((module) => ({ default: module.BirthdaysSection })));
const MyDashboardSection = lazy(() => import('@/components/sections/MyDashboardSection').then((module) => ({ default: module.MyDashboardSection })));
const ManagementSection = lazy(() => import('@/components/sections/ManagementSection').then((module) => ({ default: module.ManagementSection })));
const FacialRegistrationSection = lazy(() => import('@/components/sections/FacialRegistrationSection').then((module) => ({ default: module.FacialRegistrationSection })));
const DataManagementSection = lazy(() => import('@/components/sections/DataManagementSection').then((module) => ({ default: module.DataManagementSection })));
const SectorManagementSection = lazy(() => import('@/components/sections/SectorManagementSection').then((module) => ({ default: module.SectorManagementSection })));
const ImportantAnnouncementsSection = lazy(() => import('@/components/sections/ImportantAnnouncementsSection').then((module) => ({ default: module.ImportantAnnouncementsSection })));
const TaskBoardSection = lazy(() => import('@/components/sections/TaskBoardSection').then((module) => ({ default: module.TaskBoardSection })));
const PeopleManagementSection = lazy(() => import('@/components/sections/PeopleManagementSection').then((module) => ({ default: module.PeopleManagementSection })));
const FeedbackEmailSection = lazy(() => import('@/components/sections/FeedbackEmailSection').then((module) => ({ default: module.FeedbackEmailSection })));
const LogsSection = lazy(() => import('@/components/sections/LogsSection').then((module) => ({ default: module.LogsSection })));
const StorageMonitoringSection = lazy(() => import('@/components/sections/StorageMonitoringSection').then((module) => ({ default: module.StorageMonitoringSection })));
const EventHistorySection = lazy(() => import('@/components/sections/EventHistorySection').then((module) => ({ default: module.EventHistorySection })));
const CalendarSection = lazy(() => import('@/components/sections/CalendarSection').then((module) => ({ default: module.CalendarSection })));
const DocumentationSection = lazy(() => import('@/components/sections/DocumentationSection').then((module) => ({ default: module.DocumentationSection })));
const ApiManagementSection = lazy(() => import('@/components/sections/ApiManagementSection').then((module) => ({ default: module.ApiManagementSection })));
const WarRoomSection = lazy(() => import('@/components/sections/WarRoomSection').then((module) => ({ default: module.WarRoomSection })));
const EvaluationsSection = lazy(() => import('@/components/sections/EvaluationsSection').then((module) => ({ default: module.EvaluationsSection })));
const NotesSection = lazy(() => import('@/components/sections/NotesSection').then((module) => ({ default: module.NotesSection })));
const CompaniesManagementSection = lazy(() => import('@/components/sections/CompaniesManagementSection').then((module) => ({ default: module.CompaniesManagementSection })));
const SystemBroadcastsSection = lazy(() => import('@/components/sections/SystemBroadcastsSection').then((module) => ({ default: module.SystemBroadcastsSection })));
const ShortcutsManagementSection = lazy(() => import('@/components/sections/ShortcutsManagementSection').then((module) => ({ default: module.ShortcutsManagementSection })));
import { SystemBroadcastBanner } from '@/components/layout/SystemBroadcastBanner';
import { FloatingNoteWindow } from '@/components/notes/FloatingNoteWindow';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { BirthdayCelebrationModal } from '@/components/birthday/BirthdayCelebrationModal';
import { ImportantAnnouncementModal } from '@/components/announcements/ImportantAnnouncementModal';
import { BoardJoinDialog } from '@/components/tasks/BoardJoinDialog';
import { useWarRoomAlarm } from '@/hooks/useWarRoomAlarm';
import { WarRoomAlarmOverlay } from '@/components/warroom/WarRoomAlarmOverlay';
import { MobileShell } from '@/components/layout/mobile/MobileShell';

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
  'important-announcements': { title: 'Comunicados Importantes', subtitle: 'Avisos em destaque' },
  tasks: { title: 'Gestão de Tarefas', subtitle: 'Quadro de atividades' },
  'people-management': { title: 'Gestão de Pessoas', subtitle: 'Equipe e relatórios' },
  'feedback-email': { title: 'Disparo de Feedback', subtitle: 'E-mails de feedback mensal' },
  calendar: { title: 'Calendário', subtitle: 'Reuniões, lembretes e prazos' },
  'system-logs': { title: 'Logs do Sistema', subtitle: 'Auditoria e relatórios' },
  storage: { title: 'Armazenamento', subtitle: 'Monitoramento do banco de dados' },
  'event-history': { title: 'Eventos Mensais', subtitle: 'Histórico de campanhas' },
  documentation: { title: 'Documentação', subtitle: 'Documentação técnica do sistema' },
  'war-room': { title: 'War Room', subtitle: 'Gestão de incidentes críticos' },
  'api-management': { title: 'API de Integração', subtitle: 'Gerenciamento de integrações externas' },
  evaluations: { title: 'Avaliações', subtitle: 'Avaliação de desempenho e feedback' },
  notes: { title: 'Anotações', subtitle: 'Suas notas pessoais e compartilhadas' },
  companies: { title: 'Empresas', subtitle: 'Gestão de tenants do sistema' },
  'system-broadcasts': { title: 'Comunicados Globais', subtitle: 'Avisos para todas as empresas' },
};

const sectionPaths: Record<string, string> = {
  home: '/', 'my-dashboard': '/meu-painel', chat: '/chat', announcements: '/avisos',
  birthdays: '/aniversariantes', management: '/gerenciamento', shortcuts: '/atalhos',
  facial: '/cadastro-facial', 'data-management': '/gestao-de-dados', sectors: '/setores',
  'important-announcements': '/comunicados-importantes', tasks: '/tarefas',
  'people-management': '/gestao-de-pessoas', 'feedback-email': '/disparo-de-feedback',
  calendar: '/calendario', 'system-logs': '/logs-do-sistema', storage: '/armazenamento',
  'event-history': '/eventos-mensais', documentation: '/documentacao', 'war-room': '/war-room',
  'api-management': '/integracoes-api', evaluations: '/avaliacoes', notes: '/anotacoes',
  companies: '/empresas', 'system-broadcasts': '/comunicados-globais',
};
const pathSections = Object.fromEntries(Object.entries(sectionPaths).map(([key, path]) => [path, key])) as Record<string, string>;


const sectionIntroIcons = {
  home: Home, 'my-dashboard': LayoutDashboard, chat: MessageSquare,
  announcements: Bell, birthdays: Cake, management: Settings, shortcuts: LinkIcon,
  facial: ScanFace, 'data-management': Trash2, sectors: Building2,
  'important-announcements': Sparkles, tasks: ListTodo, 'people-management': UsersRound,
  'feedback-email': Mail, calendar: CalendarDays, 'system-logs': FileText,
  storage: HardDrive, documentation: BookOpen, 'war-room': Shield,
  'api-management': Plug, evaluations: ClipboardCheck, notes: StickyNote,
  companies: Building2, 'system-broadcasts': Megaphone, 'event-history': Sparkles,
} as const;

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
  const isMobile = useIsMobile(); const [isReady, setIsReady] = useState(false); const { profile, isAdmin } = useAuth();
  const { showOnboarding, completeOnboarding } = useOnboarding(); const { showCelebration, closeCelebration, userName } = useBirthdayCelebration(); const { pendingAnnouncement, dismissAnnouncement } = useImportantAnnouncements(); const { isAlarming, pendingWarRoomId, dismissAlarm } = useWarRoomAlarm();
  const handleOpenWarRoom = () => { handleSectionChange('war-room'); dismissAlarm(); };
  usePresence(); useMeetingStatus();
  useEffect(() => { const timer = requestAnimationFrame(() => setIsReady(true)); return () => cancelAnimationFrame(timer); }, []);
  const handleNavigateToChat = () => handleSectionChange('chat'); const handleNavigateToAnnouncements = () => handleSectionChange('announcements');
  const handleRegisterFacial = () => { completeOnboarding(); handleSectionChange('facial'); };

  if (showOnboarding && profile) return <OnboardingScreen userName={profile.display_name || profile.name} onComplete={completeOnboarding} onRegisterFacial={handleRegisterFacial} />;
  if (!isReady) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex flex-col items-center gap-4"><div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" /><p className="text-muted-foreground">Carregando...</p></div></div>;

  const renderSection = () => {
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
      case 'important-announcements': return <ImportantAnnouncementsSection />;
      case 'tasks': return <TaskBoardSection />;
      case 'people-management': return <PeopleManagementSection />;
      case 'feedback-email': return <FeedbackEmailSection />;
      case 'calendar': return <CalendarSection />;
      case 'system-logs': return <LogsSection />;
      case 'storage': return <StorageMonitoringSection />;
      case 'event-history': return <EventHistorySection />;
      case 'documentation': return <DocumentationSection />;
      case 'war-room': return <WarRoomSection />;
      case 'api-management': return <ApiManagementSection />;
      case 'evaluations': return <EvaluationsSection />;
      case 'notes': return <NotesSection />;
      case 'companies': return <CompaniesManagementSection />;
      case 'system-broadcasts': return <SystemBroadcastsSection />;
      default: return <HomeSection onNavigate={setActiveSection} />;
    }
  };

  const currentSection = sectionTitles[activeSection] || sectionTitles.home; const isHomePage = activeSection === 'home';
  if (isMobile) {
    return <><SectionTransitionIndicator section={activeSection} /><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><MobileShell activeSection={activeSection} onSectionChange={handleSectionChange} globalSearch={globalSearch} /><InstallPrompt /><ChatbotWidget isHomePage={isHomePage} /><BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} />{pendingAnnouncement && !showCelebration && !showOnboarding && <ImportantAnnouncementModal isOpen={true} onClose={dismissAnnouncement} title={pendingAnnouncement.title} content={pendingAnnouncement.content} borderStyle={pendingAnnouncement.border_style} />}<BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /><FloatingNoteWindow /></>;
  }
  return <div className="flex h-screen overflow-hidden bg-background"><SectionTransitionIndicator section={activeSection} /><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} /><div className="flex flex-1 flex-col overflow-hidden"><Header title={currentSection.title} subtitle={currentSection.subtitle} activeSection={activeSection} searchQuery={globalSearch} onSearchChange={setGlobalSearch} onNavigateToSection={handleSectionChange} /><main className={`ewvon-main min-w-0 flex-1 overflow-auto bg-white ${activeSection === 'chat' ? 'ewvon-main-chat' : ''}`}><Suspense fallback={<div className="flex min-h-48 items-center justify-center" role="status" aria-label="Carregando seção"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>{renderSection()}</Suspense></main></div><InstallPrompt /><ChatbotWidget isHomePage={isHomePage} /><BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} />{pendingAnnouncement && !showCelebration && !showOnboarding && <ImportantAnnouncementModal isOpen={true} onClose={dismissAnnouncement} title={pendingAnnouncement.title} content={pendingAnnouncement.content} borderStyle={pendingAnnouncement.border_style} />}<BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /><FloatingNoteWindow /></div>;
};
export default Index;
