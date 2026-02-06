import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Bell, 
  ListTodo, 
  Cake, 
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useBirthdays, useSectors } from '@/hooks/useData';
import { useAnnouncements } from '@/hooks/useAnnouncements';

interface HomeSectionProps {
  onNavigate: (section: string) => void;
}

const autonomyLevelLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  colaborador: 'Colaborador',
};

export function HomeSection({ onNavigate }: HomeSectionProps) {
  const { profile, sector } = useAuth();
  const { sectors } = useSectors();
  const { messages } = useMessages(sector?.id || null);
  const { announcements } = useAnnouncements();
  const { birthdayPeople } = useBirthdays();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const todayBirthdays = birthdayPeople.filter((p) => p.isToday);
  const latestAnnouncement = announcements[0];
  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const autonomyLevel = profile?.autonomy_level || 'colaborador';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 overflow-hidden rounded-2xl gradient-hero p-8 text-white"
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-white/20">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl font-bold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/70">Bem-vindo de volta,</p>
              <h2 className="font-display text-2xl md:text-3xl font-bold break-words leading-tight">{displayName}</h2>
              <div className="mt-2 flex items-center gap-2">
                {sector && (
                  <Badge 
                    className="text-white hover:bg-white/30"
                    style={{ backgroundColor: `${sector.color}80` }}
                  >
                    {sector.name}
                  </Badge>
                )}
                <Badge variant="outline" className="border-secondary text-secondary">
                  {autonomyLevelLabels[autonomyLevel]}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="rounded-xl bg-white/10 px-6 py-4 backdrop-blur-sm">
              <p className="text-sm text-white/70">Mensagens Hoje</p>
              <p className="font-display text-3xl font-bold">{messages.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-6 py-4 backdrop-blur-sm">
              <p className="text-sm text-white/70">Avisos</p>
              <p className="font-display text-3xl font-bold">{announcements.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          { id: 'chat', icon: MessageSquare, label: 'Chat', color: 'bg-primary', count: messages.length },
          { id: 'announcements', icon: Bell, label: 'Avisos', color: 'bg-secondary', count: announcements.length },
          { id: 'birthdays', icon: Cake, label: 'Aniversariantes', color: 'bg-success', count: todayBirthdays.length },
          { id: 'tasks', icon: ListTodo, label: 'Tarefas', color: 'bg-purple-500', count: null },
        ].map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1"
              onClick={() => onNavigate(action.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} text-white transition-transform group-hover:scale-110`}
                >
                  <action.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{action.label}</p>
                  {action.count !== null && (
                    <p className="text-sm text-muted-foreground">
                      {action.count} {action.count === 1 ? 'item' : 'itens'}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest Announcement */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-display">
                <Bell className="h-5 w-5 text-secondary" />
                Último Aviso
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('announcements')}>
                Ver todos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {latestAnnouncement ? (
                <>
                  <h4 className="mb-2 font-semibold text-foreground">{latestAnnouncement.title}</h4>
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                    {latestAnnouncement.content}
                  </p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(latestAnnouncement.author?.display_name || latestAnnouncement.author?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {latestAnnouncement.author?.display_name || latestAnnouncement.author?.name}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground">Nenhum aviso publicado</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Birthdays */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-display">
                <Cake className="h-5 w-5 text-secondary" />
                Aniversariantes de Hoje
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('birthdays')}>
                Ver todos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {todayBirthdays.length > 0 ? (
                <div className="space-y-3">
                  {todayBirthdays.slice(0, 3).map((person) => (
                    <div key={person.id} className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-secondary">
                        <AvatarImage src={person.avatar} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {getInitials(person.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{person.name}</p>
                        <p className="text-sm text-muted-foreground">{person.sector}</p>
                      </div>
                      <span className="ml-auto text-2xl">🎂</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  Nenhum aniversariante hoje
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
