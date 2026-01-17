import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Bell, HelpCircle, Sparkles, ChevronRight, Check, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

type TabType = 'notifications' | 'help' | 'sectors';

const helpItems = [
  {
    title: 'Bem-vindo ao ServChat!',
    content: 'O ServChat é a plataforma de comunicação interna do Grupo Servsul. Aqui você pode trocar mensagens com sua equipe, receber avisos importantes e muito mais.',
  },
  {
    title: 'Como usar o Chat',
    content: 'Na aba "Chat", você pode enviar mensagens para seu setor. Selecione o setor desejado nas abas superiores. O setor "Geral" está disponível para todos os colaboradores.',
  },
  {
    title: 'Mensagens Diretas',
    content: 'Clique na aba "Mensagens" para conversar individualmente com outros colaboradores. Você pode ver quem está online e iniciar conversas privadas.',
  },
  {
    title: 'Avisos Gerais',
    content: 'A aba "Avisos" mostra os comunicados oficiais da empresa. Fique atento aos avisos marcados como "Urgente" ou "Importante".',
  },
  {
    title: 'Mural de Aniversariantes',
    content: 'Consulte a aba "Aniversariantes" para ver os aniversários do mês e parabenizar seus colegas!',
  },
];

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, profile, sector, additionalSectors, isAdmin } = useAuth();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching notifications:', error);
      } else {
        setNotifications(data || []);
      }
      setLoading(false);
    };

    fetchNotifications();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Agora';
    if (diffMinutes < 60) return `${diffMinutes}m atrás`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full gradient-primary shadow-lg hover:shadow-xl transition-shadow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Bot className="h-7 w-7 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Widget Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between gradient-primary p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Assistente ServChat</h3>
                    <p className="text-xs text-white/70">Olá, {profile?.display_name || profile?.name || 'Usuário'}!</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === 'notifications'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  <span>Notificações</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] px-1 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('help')}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === 'help'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Ajuda</span>
                </button>
                <button
                  onClick={() => setActiveTab('sectors')}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === 'sectors'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Setores</span>
                </button>
              </div>

              {/* Content */}
              <ScrollArea className="h-[350px]">
                {activeTab === 'notifications' && (
                  <div className="p-3">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="mb-2 h-10 w-10 text-muted-foreground" />
                        <p className="font-medium text-foreground">Nenhuma notificação</p>
                        <p className="text-sm text-muted-foreground">
                          Você está em dia!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {notifications.map((notification) => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`rounded-lg border p-3 transition-colors ${
                              notification.is_read
                                ? 'border-border bg-background'
                                : 'border-primary/30 bg-primary/5'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-foreground">
                                    {notification.title}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {notification.message}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatTime(notification.created_at)}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'help' && (
                  <div className="p-3 space-y-3">
                    {helpItems.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <ChevronRight className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">{item.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.content}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {activeTab === 'sectors' && (
                  <div className="p-3">
                    <p className="mb-3 text-sm text-muted-foreground">
                      {isAdmin
                        ? 'Como administrador, você tem acesso a todos os setores.'
                        : 'Setores que você tem acesso:'}
                    </p>
                    <div className="space-y-2">
                      {/* Primary Sector */}
                      {sector && (
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: sector.color }}
                          />
                          <div>
                            <span className="font-medium text-foreground">{sector.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              Principal
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Geral Sector */}
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                        <div className="h-4 w-4 rounded-full bg-blue-500" />
                        <div>
                          <span className="font-medium text-foreground">Geral</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            Todos
                          </Badge>
                        </div>
                      </div>

                      {/* Additional Sectors */}
                      {additionalSectors.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                        >
                          <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <div>
                            <span className="font-medium text-foreground">{s.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              Adicional
                            </Badge>
                          </div>
                        </div>
                      ))}

                      {isAdmin && (
                        <p className="mt-3 text-xs text-muted-foreground italic">
                          Administradores podem visualizar e interagir com todos os setores do sistema.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}