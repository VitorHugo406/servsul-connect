import { useState } from 'react';
import { Bell, LogOut, Mail, Building2, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useSectors } from '@/hooks/useData';
import { NotificationPanel } from './NotificationPanel';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  onNavigateToChat?: () => void;
  onNavigateToAnnouncements?: () => void;
}

const autonomyLevelLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  colaborador: 'Colaborador',
};

export function MobileHeader({ title, subtitle, onNavigateToChat, onNavigateToAnnouncements }: MobileHeaderProps) {
  const { profile, signOut } = useAuth();
  const { counts } = useNotifications();
  const { sectors } = useSectors();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const totalNotifications = counts.unreadMessages + counts.unreadAnnouncements;
  const userSector = sectors.find(s => s.id === profile?.sector_id);
  const autonomyLevel = profile?.autonomy_level || 'colaborador';

  const formatBirthDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não informado';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-background border-b border-border safe-area-pt">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              className="relative p-2 rounded-full hover:bg-accent"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {totalNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {totalNotifications > 99 ? '99+' : totalNotifications}
                </Badge>
              )}
            </button>

            <button onClick={() => setShowProfile(true)}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>
      </header>

      {/* Profile Sheet */}
      <Sheet open={showProfile} onOpenChange={setShowProfile}>
        <SheetContent side="right" className="w-full max-w-sm">
          <SheetHeader className="text-left">
            <SheetTitle>Meu Perfil</SheetTitle>
          </SheetHeader>

          <div className="mt-6 flex flex-col items-center">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-semibold text-foreground">{displayName}</h2>
            <Badge className="mt-2" variant="secondary">
              {autonomyLevelLabels[autonomyLevel]}
            </Badge>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.email || 'Não informado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Setor</p>
                <div className="flex items-center gap-2">
                  {userSector && (
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: userSector.color }}
                    />
                  )}
                  <p className="text-sm font-medium text-foreground truncate">
                    {userSector?.name || 'Não definido'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Aniversário</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {formatBirthDate(profile?.birth_date || null)}
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <Button 
            variant="destructive" 
            className="w-full gap-2"
            onClick={() => {
              setShowProfile(false);
              signOut();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </SheetContent>
      </Sheet>

      {/* Notification Panel */}
      <NotificationPanel
        open={showNotifications}
        onOpenChange={setShowNotifications}
        onNavigateToChat={onNavigateToChat}
        onNavigateToAnnouncements={onNavigateToAnnouncements}
      />
    </>
  );
}
