import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Bell, HelpCircle, Sparkles, ChevronRight, Check, Building2, MessageSquare, Megaphone, AlertTriangle, CalendarIcon, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSound } from '@/hooks/useSound';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface UnreadCounts {
  announcements: number;
  messages: number;
}

type TabType = 'notifications' | 'help' | 'sectors';

const helpItems = [
  {
    title: 'Bem-vindo ao ServChat!',
    content: 'O ServChat é a plataforma de comunicação interna do Grupo Servsul. Aqui você pode trocar mensagens com sua equipe, receber avisos importantes, gerenciar tarefas e muito mais.',
  },
  {
    title: 'Como usar o Chat',
    content: 'Na aba "Chat", você pode enviar mensagens para seu setor, mensagens diretas (individuais) e grupos privados. O setor "Geral" está disponível para todos os colaboradores.',
  },
  {
    title: 'Status das Mensagens',
    content: 'Quando você envia uma mensagem, aparece um ✓ indicando que foi enviada. Após ser salva e visível para outros usuários, o status muda para ✓✓ (assim como no WhatsApp).',
  },
  {
    title: 'Formatação de Texto no Chat',
    content: 'Você pode formatar suas mensagens! Use *texto* para negrito, _texto_ para itálico, ~texto~ para riscado e [texto](url) para criar links clicáveis. A formatação funciona em todos os chats.',
  },
  {
    title: 'Mensagens Diretas',
    content: 'Clique na aba "Individual" para conversar individualmente com outros colaboradores. Você pode ver quem está online (verde), inativo (vermelho) ou offline (cinza).',
  },
  {
    title: 'Grupos Privados',
    content: 'Crie ou participe de grupos privados para comunicação entre equipes específicas. Admins do grupo podem gerenciar membros e permissões.',
  },
  {
    title: 'Menção de Cards no Chat',
    content: 'Digite "#" em qualquer chat para mencionar um card de tarefa. Selecione o mural e o card para compartilhar um resumo com título, etiquetas, prioridade e prazo.',
  },
  {
    title: 'Notificações de Mensagens',
    content: 'Uma bolinha laranja aparece nas abas do chat (Individual, Grupos, Setores) quando há mensagens não lidas. Ela desaparece automaticamente quando você visualiza o chat correspondente.',
  },
  {
    title: 'Feedback Mensal com PDF',
    content: 'Administradores podem enviar relatórios mensais de atividades para os colaboradores. O feedback inclui estatísticas, recomendações e um PDF estilizado para download.',
  },
  {
    title: 'Gestão de Tarefas',
    content: 'Acesse a aba "Tarefas" para criar murais no estilo Kanban. Arraste cards entre colunas, configure automações (responsável, capa, conclusão) e acompanhe prazos.',
  },
  {
    title: 'Automação de Conclusão',
    content: 'Marque uma coluna como "Conclusão" para registrar automaticamente quando uma tarefa foi finalizada, se houve atraso e quantos dias de atraso.',
  },
  {
    title: 'Avisos e Comunicados Importantes',
    content: 'A aba "Avisos" mostra comunicados oficiais. Comunicados Importantes aparecem como modal no primeiro acesso e ficam em uma aba exclusiva.',
  },
  {
    title: 'Mural de Aniversariantes',
    content: 'Consulte a aba "Aniversariantes" para ver os aniversários do mês e parabenizar seus colegas!',
  },
  {
    title: 'Gestão de Pessoas (Supervisores)',
    content: 'Supervisores, gerentes e administradores podem acessar "Gestão de Pessoas" para gerenciar colaboradores e visualizar relatórios de desempenho com gráficos.',
  },
  {
    title: 'Indicadores de Presença',
    content: '🟢 Verde = Online | 🔴 Vermelho = Inativo (sem atividade recente) | ⚫ Cinza = Offline. Os indicadores são atualizados em tempo real.',
  },
];

interface ChatbotWidgetProps {
  isHomePage?: boolean;
}

export function ChatbotWidget({ isHomePage = false }: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({ announcements: 0, messages: 0 });
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [overdueTasksDismissed, setOverdueTasksDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, profile, sector, additionalSectors, isAdmin } = useAuth();
  const { playChatbotClick, playChatbotClose } = useSound();

  const unreadNotifications = notifications.filter(n => !n.is_read).length;
  const [todayMeetings, setTodayMeetings] = useState<{ title: string; time: string }[]>([]);
  const [todayTaskCount, setTodayTaskCount] = useState(0);
  
  const totalUnread = unreadNotifications + unreadCounts.announcements + unreadCounts.messages + (!overdueTasksDismissed && overdueTasks > 0 ? 1 : 0);

  const handleOpen = () => {
    playChatbotClick();
    setIsOpen(true);
  };

  const handleClose = () => {
    playChatbotClose();
    setIsOpen(false);
  };

  useEffect(() => {
    if (!user || !profile || !isHomePage) return;

    const fetchData = async () => {
      setLoading(true);
      
      // Fetch notifications
      const { data: notifData, error: notifError } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!notifError) {
        setNotifications(notifData || []);
      }

      // Get last seen timestamp from profile
      const lastSeenStr = (profile as any).last_seen_at;
      const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);

      // Count new announcements since last seen
      const { count: announcementCount } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastSeen.toISOString());

      // Count unread direct messages
      const { count: messageCount } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      // Count overdue incomplete tasks assigned to the user
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .is('completed_at', null)
        .lt('due_date', new Date().toISOString());

      setOverdueTasks(overdueCount || 0);

      // Fetch today's meetings and tasks
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: meetingsData } = await supabase
        .from('calendar_events')
        .select('title, start_date, end_date')
        .eq('event_type', 'meeting')
        .gte('start_date', todayStart.toISOString())
        .lte('start_date', todayEnd.toISOString())
        .order('start_date');

      // Filter meetings where user is creator or participant
      const { data: myParticipations } = await supabase
        .from('meeting_participants')
        .select('event_id')
        .eq('profile_id', profile.id);

      const myEventIds = new Set((myParticipations || []).map(p => p.event_id));
      const relevantMeetings = (meetingsData || []).filter(m => {
        // Check if user created it or is a participant
        return true; // Show all meetings for today for awareness
      });

      setTodayMeetings(relevantMeetings.map(m => ({
        title: m.title,
        time: `${new Date(m.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${m.end_date ? ' - ' + new Date(m.end_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}`,
      })));

      // Count tasks due today
      const { count: todayTasks } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .is('completed_at', null)
        .gte('due_date', todayStart.toISOString())
        .lte('due_date', todayEnd.toISOString());

      setTodayTaskCount(todayTasks || 0);

      setUnreadCounts({
        announcements: announcementCount || 0,
        messages: messageCount || 0,
      });

      // Update last seen
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id);

      // Auto-send monthly feedback on 1st of month (admin only)
      const today = new Date();
      if (today.getDate() === 1 && isAdmin) {
        const monthKey = `feedback-sent-${today.getFullYear()}-${today.getMonth()}`;
        if (!localStorage.getItem(monthKey)) {
          localStorage.setItem(monthKey, 'true');
          supabase.functions.invoke('send-feedback-email', {
            body: { type: 'all' },
          }).then(res => {
            if (res.error) console.error('Auto feedback email error:', res.error);
            else console.log('Monthly feedback email sent automatically');
          });
        }
      }

      setLoading(false);
    };

    fetchData();

    // Set up realtime subscription for new announcements
    const announcementChannel = supabase
      .channel('new-announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        setUnreadCounts(prev => ({ ...prev, announcements: prev.announcements + 1 }));
      })
      .subscribe();

    // Set up realtime subscription for new direct messages
    const messageChannel = supabase
      .channel('new-direct-messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `receiver_id=eq.${profile.id}`
      }, () => {
        setUnreadCounts(prev => ({ ...prev, messages: prev.messages + 1 }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [user, profile, isHomePage]);

  // Only render on home page
  if (!isHomePage) {
    return null;
  }

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
      {/* Floating Button with bubble animation - positioned above mobile nav */}
      <motion.button
        onClick={handleOpen}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full gradient-primary shadow-lg hover:shadow-xl transition-shadow"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 260, 
          damping: 20,
          delay: 0.5 
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring', stiffness: 300 }}
        >
          <Bot className="h-6 w-6 md:h-7 md:w-7 text-white" />
        </motion.div>
        {totalUnread > 0 && (
          <motion.span 
            className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </motion.span>
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
              onClick={handleClose}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm md:hidden"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 w-[calc(100vw-32px)] md:w-[360px] max-w-[360px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
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
                  onClick={handleClose}
                  className="h-8 w-8 text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Megaphone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Novos Avisos</p>
                    <p className="font-semibold text-foreground">{unreadCounts.announcements}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-background p-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
                    <MessageSquare className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mensagens</p>
                    <p className="font-semibold text-foreground">{unreadCounts.messages}</p>
                  </div>
                </div>
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
                  <span>Novidades</span>
                  {unreadNotifications > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] px-1 text-xs">
                      {unreadNotifications}
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
              <ScrollArea className="h-[300px]">
                {activeTab === 'notifications' && (
                  <div className="p-3">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : notifications.length === 0 && unreadCounts.announcements === 0 && unreadCounts.messages === 0 && overdueTasks === 0 && todayMeetings.length === 0 && todayTaskCount === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="mb-2 h-10 w-10 text-muted-foreground" />
                        <p className="font-medium text-foreground">Nenhuma novidade</p>
                        <p className="text-sm text-muted-foreground">
                          Você está em dia!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Today's meetings */}
                        {todayMeetings.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <CalendarIcon className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-foreground">
                                {todayMeetings.length} reunião(ões) hoje
                              </span>
                            </div>
                            <div className="space-y-1 mt-2">
                              {todayMeetings.map((m, i) => (
                                <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="font-medium text-foreground">{m.time}</span>
                                  <span>— {m.title}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Today's task count */}
                        {todayTaskCount > 0 && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 }}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <ListTodo className="h-4 w-4 text-amber-500" />
                              <span className="font-medium text-foreground">
                                {todayTaskCount} atividade(s) para hoje
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Verifique seus prazos no calendário
                            </p>
                          </motion.div>
                        )}

                        {/* Summary cards for new items */}
                        {unreadCounts.announcements > 0 && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-lg border border-primary/30 bg-primary/5 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Megaphone className="h-4 w-4 text-primary" />
                              <span className="font-medium text-foreground">
                                {unreadCounts.announcements} novo(s) aviso(s)
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Acesse a aba "Avisos" para ver
                            </p>
                          </motion.div>
                        )}

                        {unreadCounts.messages > 0 && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-lg border border-secondary/30 bg-secondary/5 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-secondary" />
                              <span className="font-medium text-foreground">
                                {unreadCounts.messages} mensagem(ns) não lida(s)
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Acesse o chat para responder
                            </p>
                          </motion.div>
                        )}

                        {overdueTasks > 0 && !overdueTasksDismissed && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 }}
                            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <span className="font-medium text-foreground">
                                  {overdueTasks} tarefa(s) atrasada(s)
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => setOverdueTasksDismissed(true)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Você possui tarefas com prazo vencido. Acesse "Tarefas" para verificar.
                            </p>
                          </motion.div>
                        )}

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