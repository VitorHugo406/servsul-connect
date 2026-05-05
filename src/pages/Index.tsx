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
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { MobileHeader } from '@/components/layout/MobileHeader';
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

const sectionTitles: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Início', subtitle: 'Visão geral do ServChat' },
  'my-dashboard': { title: 'Meu Painel', subtitle: 'Métricas e estatísticas personalizadas' },
  chat: { title: 'Chat por Setores', subtitle: 'Comunicação entre equipes' },
  announcements: { title: 'Avisos Gerais', subtitle: 'Comunicados oficiais' },
  birthdays: { title: 'Aniversariantes', subtitle: 'Mural de celebrações' },
  
  management: { title: 'Gerenciamento', subtitle: 'Administração do sistema' },
  facial: { title: 'Cadastro Facial', subtitle: 'Reconhecimento biométrico' },
  'data-management': { title: 'Exclusão de Dados', subtitle: 'Gerenciamento de dados do sistema' },
  sectors: { title: 'Gestão de Setores', subtitle: 'Departamentos da empresa' },
   'important-announcements': { title: 'Comunicados Importantes', subtitle: 'Avisos em destaque' },
   tasks: { title: 'Gestão de Tarefas', subtitle: 'Quadro de atividades' },
   'people-management': { title: 'Gestão de Pessoas', subtitle: 'Equipe e relatórios' },
   'feedback-email': { title: 'Disparo de Feedback', subtitle: 'E-mails de feedback mensal' },
   'calendar': { title: 'Calendário', subtitle: 'Reuniões, lembretes e prazos' },
   'system-logs': { title: 'Logs do Sistema', subtitle: 'Auditoria e relatórios' },
   'storage': { title: 'Armazenamento', subtitle: 'Monitoramento do banco de dados' },
   'event-history': { title: 'Eventos Mensais', subtitle: 'Histórico de campanhas' },
   'documentation': { title: 'Documentação', subtitle: 'Documentação técnica do sistema' },
   'war-room': { title: 'War Room', subtitle: 'Gestão de incidentes críticos' },
   'api-management': { title: 'API de Integração', subtitle: 'Gerenciamento de integrações externas' },
   'evaluations': { title: 'Avaliações', subtitle: 'Avaliação de desempenho e feedback' },
   'notes': { title: 'Anotações', subtitle: 'Suas notas pessoais e compartilhadas' },
};

const Index = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  
  const joinToken = searchParams.get('join');

  // Deep-link interno (ex: War Room -> Mural específico)
  // Only track searchParams changes, NOT activeSection — otherwise navigating away loops back
  useEffect(() => {
    const sectionParam = searchParams.get('section');
    if (sectionParam && sectionParam in sectionTitles) {
      setActiveSection(sectionParam);
    }
  }, [searchParams]);

  // Wrapper that clears deep-link URL params when user manually navigates
  const handleSectionChange = (section: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('section');
    next.delete('board');
    next.delete('task');
    setSearchParams(next, { replace: true });
    setActiveSection(section);
  };
  
  const handleCloseJoinDialog = () => {
    searchParams.delete('join');
    setSearchParams(searchParams, { replace: true });
  };

  const handleNavigateToTasks = () => {
    handleSectionChange('tasks');
  };
  const isMobile = useIsMobile();
  const [isReady, setIsReady] = useState(false);
  const { profile } = useAuth();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const { showCelebration, closeCelebration, userName } = useBirthdayCelebration();
  const { pendingAnnouncement, dismissAnnouncement } = useImportantAnnouncements();
  const { isAlarming, pendingWarRoomId, dismissAlarm } = useWarRoomAlarm();

  const handleOpenWarRoom = () => {
    handleSectionChange('war-room');
    dismissAlarm();
  };
  
  // Initialize presence tracking
  usePresence();
  
  // Auto-set "Em Reunião" status during scheduled meetings
  useMeetingStatus();
  
  // Ensure we're ready to render after hydration
  useEffect(() => {
    // Force a re-check after mount to ensure correct viewport detection
    const timer = requestAnimationFrame(() => {
      setIsReady(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // Navigation handlers for notifications
  const handleNavigateToChat = () => {
    handleSectionChange('chat');
  };

  const handleNavigateToAnnouncements = () => {
    handleSectionChange('announcements');
  };

  const handleRegisterFacial = () => {
    completeOnboarding();
    handleSectionChange('facial');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomeSection onNavigate={handleSectionChange} />;
      case 'my-dashboard':
        return <MyDashboardSection />;
      case 'chat':
        return <ChatSection globalSearch={globalSearch} />;
      case 'announcements':
        return <AnnouncementsSection />;
      case 'birthdays':
        return <BirthdaysSection />;
      case 'management':
        return <ManagementSection />;
      case 'facial':
        return <FacialRegistrationSection />;
      case 'data-management':
        return <DataManagementSection />;
      case 'sectors':
        return <SectorManagementSection />;
       case 'important-announcements':
         return <ImportantAnnouncementsSection />;
       case 'tasks':
          return <TaskBoardSection />;
       case 'people-management':
          return <PeopleManagementSection />;
        case 'feedback-email':
          return <FeedbackEmailSection />;
        case 'calendar':
          return <CalendarSection />;
        case 'system-logs':
          return <LogsSection />;
        case 'storage':
          return <StorageMonitoringSection />;
        case 'event-history':
          return <EventHistorySection />;
         case 'documentation':
           return <DocumentationSection />;
         case 'war-room':
           return <WarRoomSection />;
         case 'api-management':
           return <ApiManagementSection />;
         case 'evaluations':
           return <EvaluationsSection />;
         case 'notes':
           return <NotesSection />;
      default:
        return <HomeSection onNavigate={setActiveSection} />;
    }
  };

  const currentSection = sectionTitles[activeSection] || sectionTitles.home;
  const isHomePage = activeSection === 'home';

  // Show onboarding for new users
  if (showOnboarding && profile) {
    return (
      <OnboardingScreen
        userName={profile.display_name || profile.name}
        onComplete={completeOnboarding}
        onRegisterFacial={handleRegisterFacial}
      />
    );
  }

  // Show loading while detecting viewport to prevent layout flash
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} />
        <OfflineIndicator />
        <MobileHeader 
          title={currentSection.title} 
          subtitle={currentSection.subtitle}
          onNavigateToChat={handleNavigateToChat}
          onNavigateToAnnouncements={handleNavigateToAnnouncements}
        />
        
        <main className="flex-1 overflow-auto pb-20">
          {renderSection()}
        </main>

        <MobileNavigation activeSection={activeSection} onSectionChange={handleSectionChange} />
        
        {/* PWA Install Prompt */}
        <InstallPrompt />
        
        {/* Chatbot Widget - only on home page in mobile too */}
        <ChatbotWidget isHomePage={isHomePage} />
        
        {/* Birthday Celebration */}
        <BirthdayCelebrationModal
          isOpen={showCelebration}
          onClose={closeCelebration}
          userName={userName}
        />
      
      {/* Important Announcement Modal */}
      {pendingAnnouncement && !showCelebration && !showOnboarding && (
        <ImportantAnnouncementModal
          isOpen={true}
          onClose={dismissAnnouncement}
          title={pendingAnnouncement.title}
          content={pendingAnnouncement.content}
          borderStyle={pendingAnnouncement.border_style}
        />
      )}

      {/* Board Join Dialog */}
      <BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} />
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WarRoomAlarmOverlay isAlarming={isAlarming} pendingWarRoomId={pendingWarRoomId} onOpenWarRoom={handleOpenWarRoom} />
      <OfflineIndicator />
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={currentSection.title} subtitle={currentSection.subtitle} hideNotifications={isHomePage} searchQuery={globalSearch} onSearchChange={setGlobalSearch} onNavigateToSection={handleSectionChange} />
        
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />

      <ChatbotWidget isHomePage={isHomePage} />
      
      {/* Birthday Celebration */}
      <BirthdayCelebrationModal
        isOpen={showCelebration}
        onClose={closeCelebration}
        userName={userName}
      />
      
      {/* Important Announcement Modal */}
      {pendingAnnouncement && !showCelebration && !showOnboarding && (
        <ImportantAnnouncementModal
          isOpen={true}
          onClose={dismissAnnouncement}
          title={pendingAnnouncement.title}
          content={pendingAnnouncement.content}
          borderStyle={pendingAnnouncement.border_style}
        />
      )}

      {/* Board Join Dialog */}
      <BoardJoinDialog token={joinToken} onClose={handleCloseJoinDialog} onNavigateToTasks={handleNavigateToTasks} />
      
    </div>
  );
};

export default Index;
