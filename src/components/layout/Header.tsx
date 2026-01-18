import { useState } from 'react';
import { Search, Bell, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { UserProfileDialog } from '@/components/user/UserProfileDialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideNotifications?: boolean;
}

export function Header({ title, subtitle, hideNotifications = false }: HeaderProps) {
  const { counts } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-16 items-center justify-between border-b border-border bg-card px-6"
      >
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="w-64 bg-muted/50 pl-10 focus-visible:ring-primary"
            />
          </div>
          
          {/* Notifications - hidden on home page */}
          {!hideNotifications && (
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {counts.total > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-secondary p-0 text-xs">
                      {counts.total > 99 ? '99+' : counts.total}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="border-b border-border p-4">
                  <h3 className="font-semibold">Notificações</h3>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-4 space-y-3">
                    {counts.unreadMessages > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Mensagens não lidas</p>
                          <p className="text-xs text-muted-foreground">
                            {counts.unreadMessages} {counts.unreadMessages === 1 ? 'mensagem' : 'mensagens'}
                          </p>
                        </div>
                      </div>
                    )}
                    {counts.unreadAnnouncements > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="h-2 w-2 rounded-full bg-secondary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Avisos não lidos</p>
                          <p className="text-xs text-muted-foreground">
                            {counts.unreadAnnouncements} {counts.unreadAnnouncements === 1 ? 'aviso' : 'avisos'}
                          </p>
                        </div>
                      </div>
                    )}
                    {counts.total === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma notificação</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          {/* Profile button */}
          <Button variant="ghost" size="icon" onClick={() => setShowProfile(true)}>
            <User className="h-5 w-5" />
          </Button>
          
          {/* Date */}
          <div className="hidden text-right lg:block">
            <p className="text-sm font-medium text-foreground">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </motion.header>

      <UserProfileDialog open={showProfile} onOpenChange={setShowProfile} />
    </>
  );
}
