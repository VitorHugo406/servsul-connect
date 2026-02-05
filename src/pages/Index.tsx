import { useState, useEffect } from 'react';
import { usePresence } from '@/hooks/usePresence';
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
import { ChartsSection } from '@/components/sections/ChartsSection';
import { ManagementSection } from '@/components/sections/ManagementSection';
import { FacialRegistrationSection } from '@/components/sections/FacialRegistrationSection';
import { DataManagementSection } from '@/components/sections/DataManagementSection';
import { SectorManagementSection } from '@/components/sections/SectorManagementSection';
 import { ImportantAnnouncementsSection } from '@/components/sections/ImportantAnnouncementsSection';
 import { TaskBoardSection } from '@/components/sections/TaskBoardSection';
import { ChatbotWidget } from '@/components/chatbot/ChatbotWidget';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { BirthdayCelebrationModal } from '@/components/birthday/BirthdayCelebrationModal';
import { ImportantAnnouncementModal } from '@/components/announcements/ImportantAnnouncementModal';

const sectionTitles: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Início', subtitle: 'Visão geral do ServChat' },
  chat: { title: 'Chat por Setores', subtitle: 'Comunicação entre equipes' },
  announcements: { title: 'Avisos Gerais', subtitle: 'Comunicados oficiais' },
  birthdays: { title: 'Aniversariantes', subtitle: 'Mural de celebrações' },
  charts: { title: 'Gráficos', subtitle: 'Visualização de dados' },
  management: { title: 'Gerenciamento', subtitle: 'Administração do sistema' },
  facial: { title: 'Cadastro Facial', subtitle: 'Reconhecimento biométrico' },
  'data-management': { title: 'Exclusão de Dados', subtitle: 'Gerenciamento de dados do sistema' },
  sectors: { title: 'Gestão de Setores', subtitle: 'Departamentos da empresa' },
   'important-announcements': { title: 'Comunicados Importantes', subtitle: 'Avisos em destaque' },
   tasks: { title: 'Gestão de Tarefas', subtitle: 'Quadro de atividades' },
};

const Index = () => {
  const [activeSection, setActiveSection] = useState('home');
  const isMobile = useIsMobile();
  const [isReady, setIsReady] = useState(false);
  const { profile } = useAuth();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const { showCelebration, closeCelebration, userName } = useBirthdayCelebration();
  const { pendingAnnouncement, dismissAnnouncement } = useImportantAnnouncements();
  
  // Initialize presence tracking
  usePresence();
  
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
    setActiveSection('chat');
  };

  const handleNavigateToAnnouncements = () => {
    setActiveSection('announcements');
  };

  const handleRegisterFacial = () => {
    completeOnboarding();
    setActiveSection('facial');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomeSection onNavigate={setActiveSection} />;
      case 'chat':
        return <ChatSection />;
      case 'announcements':
        return <AnnouncementsSection />;
      case 'birthdays':
        return <BirthdaysSection />;
      case 'charts':
        return <ChartsSection />;
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

        <MobileNavigation activeSection={activeSection} onSectionChange={setActiveSection} />
        
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
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <OfflineIndicator />
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={currentSection.title} subtitle={currentSection.subtitle} hideNotifications={isHomePage} />
        
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
    </div>
  );
};

export default Index;
