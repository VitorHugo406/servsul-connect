import { ReactNode, useState, useEffect } from 'react';
import { Home, MessageSquare, Bell, LogOut, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { NotificationPanel } from '@/components/layout/NotificationPanel';
import { MobileHomeView } from '@/components/sections/mobile/MobileHomeView';
import { ChatSection } from '@/components/sections/ChatSection';
import { AnnouncementsSection } from '@/components/sections/AnnouncementsSection';

const MOBILE_ALLOWED = new Set(['home', 'chat', 'announcements']);

const TABS: Array<{ id: 'home' | 'chat' | 'announcements'; label: string; icon: typeof Home; eyebrow: string }> = [
  { id: 'home', label: 'Início', icon: Home, eyebrow: 'Visão geral' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, eyebrow: 'Setores' },
  { id: 'announcements', label: 'Avisos', icon: Bell, eyebrow: 'Comunicados' },
];

interface MobileShellProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  globalSearch: string;
  onOpenChatbot?: () => void;
}

export function MobileShell({ activeSection, onSectionChange, globalSearch, onOpenChatbot }: MobileShellProps) {
  const { profile, signOut } = useAuth();
  const { company } = useCompany();
  const { counts } = useNotifications();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Force mobile users into the allowed 3-tab world
  useEffect(() => {
    if (!MOBILE_ALLOWED.has(activeSection)) {
      onSectionChange('home');
    }
  }, [activeSection, onSectionChange]);

  const current = TABS.find((t) => t.id === activeSection) ?? TABS[0];
  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const totalNotifs = counts.unreadMessages + counts.unreadAnnouncements;

  const renderContent = () => {
    switch (current.id) {
      case 'chat':
        return (
          <div className="h-full flex flex-col">
            <ChatSection globalSearch={globalSearch} />
          </div>
        );
      case 'announcements':
        return <AnnouncementsSection />;
      case 'home':
      default:
        return <MobileHomeView onNavigate={onSectionChange} />;
    }
  };

  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 15% 0%, hsla(var(--company-hue,220), 70%, 60%, 0.10), transparent 45%),' +
          'radial-gradient(circle at 85% 100%, hsla(var(--company-hue,220), 70%, 50%, 0.08), transparent 40%),' +
          'hsl(var(--background))',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Topbar */}
      <header className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {current.eyebrow}
          </div>
          <div
            className="text-[18px] font-bold text-foreground truncate"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            {current.label}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowNotifications(true)}
            className="relative w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground"
            aria-label="Notificações"
          >
            <Bell className="w-4 h-4" />
            {totalNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center px-1 border-2 border-background">
                {totalNotifs > 99 ? '99+' : totalNotifs}
              </span>
            )}
          </button>
          <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-xl overflow-hidden">
            <Avatar className="w-9 h-9 rounded-xl">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
              <AvatarFallback
                className="rounded-xl text-white text-xs font-bold"
                style={{ background: 'linear-gradient(140deg, var(--brand, hsl(var(--primary))), var(--brand-2, hsl(var(--secondary))))' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto pb-24">{renderContent()}</div>
      </main>

      {/* Bottom nav with FAB */}
      <nav
        className="relative flex items-center justify-around px-3 pt-3 pb-6 border-t border-border shrink-0"
        style={{ background: 'hsl(var(--card))' }}
      >
        {current.id === 'home' && onOpenChatbot && (
          <button
            onClick={onOpenChatbot}
            className="absolute right-5 -top-6 w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{
              background: 'linear-gradient(140deg, var(--brand, hsl(var(--primary))), var(--brand-2, hsl(var(--secondary))))',
              boxShadow: '0 12px 22px -8px var(--brand-glow, hsl(var(--primary) / 0.35))',
            }}
            aria-label="Assistente"
          >
            <Bot className="w-6 h-6" />
          </button>
        )}
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current.id === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSectionChange(tab.id)}
              className={cn(
                'flex flex-col items-center gap-1 w-16 text-[10.5px] font-semibold transition-colors',
                active ? 'text-[color:var(--brand,hsl(var(--primary)))]' : 'text-muted-foreground',
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Notifications */}
      <NotificationPanel
        open={showNotifications}
        onOpenChange={setShowNotifications}
        onNavigateToChat={() => {
          setShowNotifications(false);
          onSectionChange('chat');
        }}
        onNavigateToAnnouncements={() => {
          setShowNotifications(false);
          onSectionChange('announcements');
        }}
      />

      {/* Profile sheet */}
      <Sheet open={showProfile} onOpenChange={setShowProfile}>
        <SheetContent side="right" className="w-full max-w-sm">
          <SheetHeader className="text-left">
            <SheetTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Meu Perfil</SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col items-center">
            <Avatar className="h-20 w-20 rounded-2xl">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
              <AvatarFallback
                className="rounded-2xl text-white text-2xl font-bold"
                style={{ background: 'linear-gradient(140deg, var(--brand, hsl(var(--primary))), var(--brand-2, hsl(var(--secondary))))' }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-lg font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              {displayName}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{profile?.email}</p>
            {company && (
              <div
                className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'var(--brand-glow-soft, hsl(var(--primary) / 0.12))', color: 'var(--brand, hsl(var(--primary)))' }}
              >
                {company.logo_url && (
                  <img src={company.logo_url} alt={company.name} className="w-4 h-4 rounded object-cover" />
                )}
                {company.name}
              </div>
            )}
          </div>

          <div className="mt-8">
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => {
                setShowProfile(false);
                signOut();
              }}
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
