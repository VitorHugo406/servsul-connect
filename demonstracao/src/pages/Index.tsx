import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePresence } from '@/hooks/usePresence';
import { useMeetingStatus } from '@/hooks/useMeetingStatus';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useBirthdayCelebration } from '@/hooks/useBirthdayCelebration';
import { useImportantAnnouncements } from '@/hooks/useImportantAnnouncements';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { HomeSection } from '@/components/sections/HomeSection';
import { ChatSection } from '@/components/sections/ChatSection';
import { AnnouncementsSection } from '@/components/sections/AnnouncementsSection';
import { BirthdaysSection } from '@/components/sections/BirthdaysSection';
import { MyDashboardSection } from '@/components/sections/MyDashboardSection';
import { ManagementSection } from '@/components/sections/ManagementSection';
import { FacialRegistrationSection } from '@/components/sections/FacialRegistrationSection';
import { DataManagementSection } from '@/components/sections/DataManagementSection';
import { SectorManagementSection } from '@/components/sections/SectorManagementSection';
import { ImportantAnnouncementsSection } from '@/components/sections/ImportantAnnouncementsSection';
import { TaskBoardSection } from '@/components/sections/TaskBoardSection';
import { PeopleManagementSection } from '@/components/sections/PeopleManagementSection';
import { FeedbackEmailSection } from '@/components/sections/FeedbackEmailSection';
import { LogsSection } from '@/components/sections/LogsSection';
import { StorageMonitoringSection } from '@/components/sections/StorageMonitoringSection';
import { EventHistorySection } from '@/components/sections/EventHistorySection';
import { CalendarSection } from '@/components/sections/CalendarSection';
import { DocumentationSection } from '@/components/sections/DocumentationSection';
import { ApiManagementSection } from '@/components/sections/ApiManagementSection';
import { WarRoomSection } from '@/components/sections/WarRoomSection';
import { EvaluationsSection } from '@/components/sections/EvaluationsSection';
import { NotesSection } from '@/components/sections/NotesSection';
import { CompaniesManagementSection } from '@/components/sections/CompaniesManagementSection';
import { SystemBroadcastsSection } from '@/components/sections/SystemBroadcastsSection';
import { ShortcutsManagementSection } from '@/components/sections/ShortcutsManagementSection';
import { SystemBroadcastBanner } from '@/components/layout/SystemBroadcastBanner';
import { FloatingNoteWindow } from '@/components/notes/FloatingNoteWindow';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import { SeasonalMarquee } from '@/components/seasonal/SeasonalMarquee';
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
  home: { title: 'Início', subtitle: 'Visão geral do Nuvexa' },
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

const Index = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const joinToken = searchParams.get('join');

  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam && sectionParam in sectionTitles) setActiveSection(sectionParam);
  }, [searchParams]);

  const handleSectionChange = (section: string) => {
    const next = new URLSearchParams(searchParams); next.delete('section'); next.delete('board'); next.delete('task'); setSearchParams(next, { replace: true }); setActiveSection(section);
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
    return <><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><MobileShell activeSection={activeSection} onSectionChange={handleSectionChange} globalSearch={globalSearch} /><InstallPrompt /><ChatbotWidget isHomePage={isHomePage} /><BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} />{pendingAnnouncement && !showCelebration && !showOnboarding && <ImportantAnnouncementModal isOpen={true} onClose={dismissAnnouncement} title={pendingAnnouncement.title} content={pendingAnnouncement.content} borderStyle={pendingAnnouncement.border_style} />}<BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /><FloatingNoteWindow /></>;
  }
  return <div className="flex h-screen overflow-hidden bg-background"><WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} /><OfflineIndicator /><Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} /><div className="flex flex-1 flex-col overflow-hidden">{isHomePage && <><Header title={currentSection.title} subtitle={currentSection.subtitle} hideNotifications={isHomePage} searchQuery={globalSearch} onSearchChange={setGlobalSearch} onNavigateToSection={handleSectionChange} /><SystemBroadcastBanner /><SeasonalMarquee /></>}<main className="m-3 flex-1 overflow-auto rounded-[28px] border border-border/60 bg-card/30 shadow-sm">{renderSection()}</main></div><InstallPrompt /><ChatbotWidget isHomePage={isHomePage} /><BirthdayCelebrationModal isOpen={showCelebration} onClose={closeCelebration} userName={userName} />{pendingAnnouncement && !showCelebration && !showOnboarding && <ImportantAnnouncementModal isOpen={true} onClose={dismissAnnouncement} title={pendingAnnouncement.title} content={pendingAnnouncement.content} borderStyle={pendingAnnouncement.border_style} />}<BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} /><FloatingNoteWindow /></div>;
};
export default Index;
