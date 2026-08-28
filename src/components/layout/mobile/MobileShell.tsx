import { useState, useEffect } from 'react';
import { Home, MessageSquare, Bell, LogOut, Cake, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { BirthdaysSection } from '@/components/sections/BirthdaysSection';
import { getCompanyLogoUrl } from '@/lib/companyLogo';
import { SystemBroadcastBanner } from '@/components/layout/SystemBroadcastBanner';

const MOBILE_ALLOWED = new Set(['home', 'chat', 'announcements', 'birthdays']);
const TABS: Array<{ id: 'home' | 'chat' | 'announcements' | 'birthdays'; label: string; icon: typeof Home; eyebrow: string }> = [
  { id: 'home', label: 'Início', icon: Home, eyebrow: 'Visão geral' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, eyebrow: 'Setores' },
  { id: 'announcements', label: 'Avisos', icon: Bell, eyebrow: 'Comunicados' },
  { id: 'birthdays', label: 'Aniversários', icon: Cake, eyebrow: 'Este mês' },
];

interface MobileShellProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  globalSearch: string;
  onOpenChatbot?: () => void;
}

export function MobileShell({ activeSection, onSectionChange, globalSearch }: MobileShellProps) {
  const { profile, signOut, isAdmin, canAccess } = useAuth();
  const { company } = useCompany();
  const { counts } = useNotifications();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!MOBILE_ALLOWED.has(activeSection)) onSectionChange('home');
  }, [activeSection, onSectionChange]);

  const current = TABS.find((t) => t.id === activeSection) ?? TABS[0];
  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const totalNotifs = counts.unreadMessages + counts.unreadAnnouncements;
  const isChat = current.id === 'chat';
  const canCreateAnnouncement = isAdmin || canAccess('can_post_announcements');

  const openNewAnnouncement = () => window.dispatchEvent(new CustomEvent('nuvexa:open-new-announcement'));

  const renderContent = () => {
    switch (current.id) {
      case 'chat': return <ChatSection globalSearch={globalSearch} />;
      case 'announcements': return <AnnouncementsSection />;
      case 'birthdays': return <BirthdaysSection />;
      case 'home':
      default: return <MobileHomeView onNavigate={onSectionChange} />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{
      background:
        'radial-gradient(circle at 15% 0%, hsla(var(--company-hue,220), 70%, 60%, 0.10), transparent 45%),' +
        'radial-gradient(circle at 85% 100%, hsla(var(--company-hue,220), 70%, 50%, 0.08), transparent 40%),' +
        'hsl(var(--background))',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <SystemBroadcastBanner />

      {!isChat && (
        <header className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{current.eyebrow}</div>
              <div className="font-bold text-foreground truncate text-[18px]" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{current.label}</div>
            </div>
            {current.id === 'announcements' && canCreateAnnouncement && (
              <Button onClick={openNewAnnouncement} size="sm" className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5">
                <Plus className="h-4 w-4" />
                <span>Novo Aviso</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications(true)} className="relative rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground w-9 h-9" aria-label="Notificações">
              <Bell className="w-4 h-4" />
              {totalNotifs > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1 border-2 border-background">{totalNotifs > 99 ? '99+' : totalNotifs}</span>}
            </button>
            <button onClick={() => setShowProfile(true)} className="rounded-2xl overflow-hidden w-9 h-9">
              <Avatar className="rounded-2xl w-9 h-9">
                <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
                <AvatarFallback className="rounded-2xl text-primary-foreground text-xs font-bold" style={{ background: 'linear-gradient(140deg, var(--brand, hsl(var(--primary))), var(--brand-2, hsl(var(--secondary))))' }}>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </div>
        </header>
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.id} initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.985 }} transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.7 }} className={isChat ? 'flex h-full min-h-0 flex-col pb-[calc(var(--mobile-nav-h)+20px)]' : 'h-full overflow-y-auto pb-[calc(var(--mobile-nav-h)+28px)]'}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav aria-label="Navegação principal" className="glass-nav fixed bottom-4 left-1/2 z-50 grid w-[min(88vw,360px)] -translate-x-1/2 grid-cols-4 rounded-full border border-border/70 px-1.5 py-1.5 shadow-xl" style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = current.id === tab.id;
          return (
            <button key={tab.id} onClick={() => onSectionChange(tab.id)} className="relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-all active:scale-90">
              {active && <motion.span layoutId="mobile-nav-pill" className="absolute inset-x-1 inset-y-0 rounded-full bg-secondary/15" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <Icon className={cn('relative z-10 h-5 w-5 transition-colors duration-200', active ? 'text-secondary' : 'text-muted-foreground')} />
              <span className={cn('relative z-10 text-[10px] font-semibold transition-colors duration-200', active ? 'text-secondary' : 'text-muted-foreground')}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <NotificationPanel open={showNotifications} onOpenChange={setShowNotifications} onNavigateToChat={() => { setShowNotifications(false); onSectionChange('chat'); }} onNavigateToAnnouncements={() => { setShowNotifications(false); onSectionChange('announcements'); }} />

      <Sheet open={showProfile} onOpenChange={setShowProfile}>
        <SheetContent side="right" className="w-full max-w-sm">
          <SheetHeader className="text-left"><SheetTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Meu Perfil</SheetTitle></SheetHeader>
          <div className="mt-6 flex flex-col items-center">
            <Avatar className="h-20 w-20 rounded-2xl"><AvatarImage src={profile?.avatar_url || ''} alt={displayName} /><AvatarFallback className="rounded-2xl text-white text-2xl font-bold" style={{ background: 'linear-gradient(140deg, var(--brand, hsl(var(--primary))), var(--brand-2, hsl(var(--secondary))))' }}>{initials}</AvatarFallback></Avatar>
            <h2 className="mt-4 text-lg font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{displayName}</h2>
            <p className="text-xs text-muted-foreground mt-1">{profile?.email}</p>
            {company && <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'var(--brand-glow-soft, hsl(var(--primary) / 0.12))', color: 'var(--brand, hsl(var(--primary)))' }}>{company.logo_url && <img src={getCompanyLogoUrl(company.logo_url) ?? undefined} alt={company.name} className="w-4 h-4 rounded object-cover" />}{company.name}</div>}
          </div>
          <div className="mt-8"><Button variant="destructive" className="w-full gap-2" onClick={() => { setShowProfile(false); signOut(); }}><LogOut className="w-4 h-4" />Sair da conta</Button></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
