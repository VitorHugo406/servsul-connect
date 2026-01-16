import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { HomeSection } from '@/components/sections/HomeSection';
import { ChatSection } from '@/components/sections/ChatSection';
import { AnnouncementsSection } from '@/components/sections/AnnouncementsSection';
import { BirthdaysSection } from '@/components/sections/BirthdaysSection';
import { ChartsSection } from '@/components/sections/ChartsSection';

const sectionTitles: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Início', subtitle: 'Visão geral do ServChat' },
  chat: { title: 'Chat por Setores', subtitle: 'Comunicação entre equipes' },
  announcements: { title: 'Avisos Gerais', subtitle: 'Comunicados oficiais' },
  birthdays: { title: 'Aniversariantes', subtitle: 'Mural de celebrações' },
  charts: { title: 'Gráficos', subtitle: 'Visualização de dados' },
};

const Index = () => {
  const [activeSection, setActiveSection] = useState('home');

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
      default:
        return <HomeSection onNavigate={setActiveSection} />;
    }
  };

  const currentSection = sectionTitles[activeSection] || sectionTitles.home;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={currentSection.title} subtitle={currentSection.subtitle} />
        
        <main className="flex-1 overflow-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default Index;
