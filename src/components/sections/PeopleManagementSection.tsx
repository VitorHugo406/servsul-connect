import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Trash2, BarChart3, MessageSquare, ListTodo, Award, Search, CalendarDays, AlertTriangle, Bell, X, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useSupervisorTeam } from '@/hooks/useSupervisorTeam';
import { useTeamAnalytics } from '@/hooks/useTeamAnalytics';
import { useWorkloadAlerts } from '@/hooks/useWorkloadAlerts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useGlobalScores } from '@/hooks/useBoardScores';
import type { MemberScore, MonthlyScoreEntry } from '@/hooks/useBoardScores';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(270, 76%, 55%)',
];

export function PeopleManagementSection() {
  const { profile } = useAuth();
  const { members, loading, addMember, removeMember } = useSupervisorTeam();
  const memberIds = members.map(m => m.member_profile_id);
  const { analytics, loading: analyticsLoading } = useTeamAnalytics(memberIds);
  const { alerts, unreadCount, markAsRead, dismissAlert } = useWorkloadAlerts(memberIds);
  const { scores: globalScores, monthlyHistory: globalScoreHistory, loading: globalScoresLoading } = useGlobalScores(memberIds);
  const [showScorePanel, setShowScorePanel] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const fetchAvailableProfiles = async () => {
    setProfilesLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, display_name, avatar_url, email, autonomy_level')
        .eq('is_active', true)
        .order('name');
      setAllProfiles(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleAddMember = async (profileId: string) => {
    const result = await addMember(profileId);
    if (result?.error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar o colaborador.', variant: 'destructive' });
    } else {
      toast({ title: 'Colaborador adicionado à sua equipe.' });
    }
  };

  const handleRemoveMember = async (id: string) => {
    const result = await removeMember(id);
    if (result?.error) {
      toast({ title: 'Erro', description: 'Não foi possível remover o colaborador.', variant: 'destructive' });
    } else {
      toast({ title: 'Colaborador removido da equipe.' });
    }
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
    fetchAvailableProfiles();
  };

  const filteredProfiles = allProfiles.filter(p => {
    if (members.some(m => m.member_profile_id === p.id)) return false;
    if (p.id === profile?.id) return false;
    const query = searchQuery.toLowerCase();
    return (p.name?.toLowerCase().includes(query) || p.display_name?.toLowerCase().includes(query) || p.email?.toLowerCase().includes(query));
  });

  // Chart data
  const taskChartData = analytics
    .sort((a, b) => b.taskCount - a.taskCount)
    .map(a => ({
      name: a.displayName || a.name.split(' ')[0],
      tarefas: a.taskCount,
      concluídas: a.completedTasks,
    }));

  const messageChartData = analytics
    .sort((a, b) => b.messageCount - a.messageCount)
    .map(a => ({
      name: a.displayName || a.name.split(' ')[0],
      mensagens: a.messageCount,
    }));

  const interactionData = analytics.map(a => ({
    name: a.displayName || a.name.split(' ')[0],
    value: a.messageCount + a.taskCount + a.announcementComments,
  })).filter(d => d.value > 0);

  const totalTasks = analytics.reduce((sum, a) => sum + a.taskCount, 0);
  const totalCompleted = analytics.reduce((sum, a) => sum + a.completedTasks, 0);
  const totalMessages = analytics.reduce((sum, a) => sum + a.messageCount, 0);
  const totalInteractions = analytics.reduce((sum, a) => sum + a.messageCount + a.taskCount + a.announcementComments, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground">Gestão de Pessoas</h3>
          <p className="text-muted-foreground">Gerencie sua equipe e acompanhe métricas</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Adicionar Colaborador
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Equipe</p>
            <p className="font-display text-2xl font-bold text-foreground">{members.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-secondary">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total de Tarefas</p>
            <p className="font-display text-2xl font-bold text-foreground">{totalTasks}</p>
            <p className="text-xs text-muted-foreground">{totalCompleted} concluídas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(142, 76%, 36%)' }}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
            <p className="font-display text-2xl font-bold text-foreground">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(38, 92%, 50%)' }}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Interações Totais</p>
            <p className="font-display text-2xl font-bold text-foreground">{totalInteractions}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Equipe</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 relative">
            <AlertTriangle className="h-4 w-4" /> Alertas
            {unreadCount > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[9px] bg-destructive text-destructive-foreground">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /> Relatórios</TabsTrigger>
          <TabsTrigger value="activities" className="gap-2"><CalendarDays className="h-4 w-4" /> Atividades</TabsTrigger>
          <TabsTrigger value="score" className="gap-2"><Trophy className="h-4 w-4" /> Score</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold">Nenhum colaborador adicionado</h4>
                <p className="text-muted-foreground mt-1">Adicione membros da sua equipe para acompanhar métricas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {members.map(member => {
                const a = analytics.find(an => an.profileId === member.member_profile_id);
                return (
                  <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profile.avatar_url || ''} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {getInitials(member.profile.display_name || member.profile.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {member.profile.display_name || member.profile.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{member.profile.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {a && (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="flex items-center gap-1 text-xs">
                              <ListTodo className="h-3 w-3 text-primary" />
                              <span>{a.taskCount} tarefas</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <MessageSquare className="h-3 w-3 text-secondary" />
                              <span>{a.messageCount} msgs</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs">
                              <Award className="h-3 w-3 text-green-500" />
                              <span>{a.completedTasks} feitas</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          {alerts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold">Nenhum alerta</h4>
                <p className="text-muted-foreground mt-1">Alertas de sobrecarga, atrasos e cards parados aparecerão aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => {
                const member = analytics.find(a => a.profileId === alert.profile_id);
                return (
                  <Card key={alert.id} className={alert.is_read ? 'opacity-60' : ''}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={`mt-0.5 rounded-full p-1.5 ${
                        alert.alert_type === 'overloaded' ? 'bg-destructive/10 text-destructive' :
                        alert.alert_type === 'deadline_risk' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className="text-[10px]">
                            {alert.alert_type === 'overloaded' ? 'Sobrecarga' :
                             alert.alert_type === 'deadline_risk' ? 'Prazo' :
                             alert.alert_type === 'stuck_task' ? 'Parado' : 'Atraso'}
                          </Badge>
                          {member && <span className="text-xs text-muted-foreground">{member.displayName || member.name}</span>}
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!alert.is_read && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markAsRead(alert.id)} title="Marcar como lido">
                            <Bell className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismissAlert(alert.id)} title="Dispensar">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
          {analyticsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Adicione colaboradores para ver relatórios.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tasks chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListTodo className="h-5 w-5 text-primary" />
                    Tarefas por Colaborador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="tarefas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="concluídas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Messages chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-5 w-5 text-secondary" />
                    Mensagens por Colaborador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={messageChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="mensagens" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Interaction pie chart */}
              {interactionData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Distribuição de Interações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={interactionData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {interactionData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ranking table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking de Atividade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics
                      .sort((a, b) => (b.messageCount + b.taskCount + b.announcementComments) - (a.messageCount + a.taskCount + a.announcementComments))
                      .map((a, i) => (
                        <div key={a.profileId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          <span className="font-bold text-lg text-muted-foreground w-6 text-center">{i + 1}</span>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={a.avatarUrl || ''} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(a.displayName || a.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{a.displayName || a.name}</p>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{a.taskCount} tarefas</span>
                            <span>{a.messageCount} msgs</span>
                            <span>{a.announcementComments} comentários</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
        )}
        </TabsContent>

        <TabsContent value="activities" className="mt-4">
          <ActivitiesTab memberIds={memberIds} members={members} />
        </TabsContent>

        <TabsContent value="score" className="mt-4">
          <ScoreTabContent
            scores={globalScores}
            monthlyHistory={globalScoreHistory}
            loading={globalScoresLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="max-h-[400px]">
            {profilesLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">Nenhum colaborador encontrado.</p>
            ) : (
              <div className="space-y-1 pr-4">
                {filteredProfiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddMember(p.id)}
                    className="flex w-full items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(p.display_name || p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.display_name || p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{p.autonomy_level}</Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Score Tab Content
function ScoreTabContent({ scores, monthlyHistory, loading }: {
  scores: MemberScore[];
  monthlyHistory: MonthlyScoreEntry[];
  loading: boolean;
}) {
  const MONTH_LABELS: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
  };

  const LINE_COLORS = [
    'hsl(var(--primary))',
    'hsl(38, 92%, 50%)',
    'hsl(142, 76%, 36%)',
    'hsl(270, 76%, 55%)',
    'hsl(0, 72%, 51%)',
    'hsl(200, 80%, 50%)',
  ];

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-green-500';
    if (score >= 600) return 'text-yellow-500';
    if (score >= 400) return 'text-orange-500';
    return 'text-destructive';
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const uniqueMonths = [...new Set(monthlyHistory.map(h => h.yearMonth))].sort();
  const uniqueProfiles = [...new Set(monthlyHistory.map(h => h.profileId))];
  const profileNames: Record<string, string> = {};
  monthlyHistory.forEach(h => { profileNames[h.profileId] = h.name; });

  const chartData = uniqueMonths.map(ym => {
    const [year, month] = ym.split('-');
    const entry: any = { month: `${MONTH_LABELS[month]}/${year.slice(2)}` };
    uniqueProfiles.forEach(pid => {
      const record = monthlyHistory.find(h => h.yearMonth === ym && h.profileId === pid);
      entry[pid] = record?.score || 0;
    });
    return entry;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold">Sem dados de score</h4>
          <p className="text-muted-foreground mt-1">Adicione membros com tarefas para ver scores.</p>
        </CardContent>
      </Card>
    );
  }

  const top3 = scores.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Podium */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Pódio - Score Global
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-center gap-4 pt-4">
            {top3.length >= 2 && (
              <div className="flex flex-col items-center gap-2 w-20">
                <Avatar className="h-10 w-10 border-2 border-gray-400">
                  <AvatarImage src={top3[1].avatarUrl || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(top3[1].displayName || top3[1].name)}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium text-center truncate w-full">{(top3[1].displayName || top3[1].name).split(' ')[0]}</p>
                <div className="w-full h-16 rounded-t-lg bg-muted flex items-end justify-center pb-2">
                  <span className={`text-sm font-bold ${getScoreColor(top3[1].score)}`}>{top3[1].score}</span>
                </div>
              </div>
            )}
            {top3.length >= 1 && (
              <div className="flex flex-col items-center gap-2 w-20">
                <Avatar className="h-12 w-12 border-2 border-yellow-500">
                  <AvatarImage src={top3[0].avatarUrl || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">{getInitials(top3[0].displayName || top3[0].name)}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium text-center truncate w-full">{(top3[0].displayName || top3[0].name).split(' ')[0]}</p>
                <div className="w-full h-24 rounded-t-lg bg-yellow-500/10 flex items-end justify-center pb-2">
                  <span className={`text-sm font-bold ${getScoreColor(top3[0].score)}`}>{top3[0].score}</span>
                </div>
              </div>
            )}
            {top3.length >= 3 && (
              <div className="flex flex-col items-center gap-2 w-20">
                <Avatar className="h-10 w-10 border-2 border-amber-700">
                  <AvatarImage src={top3[2].avatarUrl || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(top3[2].displayName || top3[2].name)}</AvatarFallback>
                </Avatar>
                <p className="text-xs font-medium text-center truncate w-full">{(top3[2].displayName || top3[2].name).split(' ')[0]}</p>
                <div className="w-full h-12 rounded-t-lg bg-amber-700/10 flex items-end justify-center pb-2">
                  <span className={`text-sm font-bold ${getScoreColor(top3[2].score)}`}>{top3[2].score}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ranking Completo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scores.map((member, i) => (
            <div key={member.profileId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <span className="font-bold text-lg text-muted-foreground w-6 text-center">{i + 1}</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatarUrl || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{getInitials(member.displayName || member.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-sm">{member.displayName || member.name}</p>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>{member.totalTasks} tarefas</span>
                  <span>•</span>
                  <span>{member.completedTasks} concluídas</span>
                  <span>•</span>
                  <span>{member.lateTasks} atrasadas</span>
                </div>
              </div>
              <span className={`text-sm font-bold ${getScoreColor(member.score)}`}>{member.score}/1000</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Monthly chart */}
      {chartData.length > 0 && uniqueProfiles.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[0, 1000]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  {uniqueProfiles.slice(0, 6).map((pid, i) => (
                    <Bar
                      key={pid}
                      dataKey={pid}
                      name={profileNames[pid] || 'Usuário'}
                      fill={LINE_COLORS[i % LINE_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Activities Tab Component
function ActivitiesTab({ memberIds, members }: { memberIds: string[]; members: any[] }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, assigned_to, created_at, updated_at, completed_at')
          .in('assigned_to', memberIds)
          .order('updated_at', { ascending: false });
        // Filter out completed tasks
        setTasks((data || []).filter((t: any) => !t.completed_at));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [memberIds]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (memberIds.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
          <h4 className="text-lg font-semibold">Nenhum colaborador adicionado</h4>
          <p className="text-muted-foreground mt-1">Adicione membros para ver atividades.</p>
        </CardContent>
      </Card>
    );
  }

  const getMemberName = (profileId: string) => {
    const m = members.find(mem => mem.member_profile_id === profileId);
    return m?.profile?.display_name || m?.profile?.name || 'Desconhecido';
  };

  const getMemberAvatar = (profileId: string) => {
    const m = members.find(mem => mem.member_profile_id === profileId);
    return m?.profile?.avatar_url || '';
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive',
    medium: 'bg-yellow-500/10 text-yellow-600',
    low: 'bg-green-500/10 text-green-600',
  };

  const statusLabels: Record<string, string> = {
    todo: 'A Fazer',
    in_progress: 'Em Andamento',
    done: 'Concluida',
  };

  // Group tasks by member then by due_date (or created_at as fallback)
  const tasksByMember: Record<string, Record<string, any[]>> = {};
  
  for (const task of tasks) {
    const memberId = task.assigned_to;
    if (!memberId) continue;
    if (!tasksByMember[memberId]) tasksByMember[memberId] = {};
    
    const taskDate = task.due_date || task.created_at;
    const dateKey = new Date(taskDate).toLocaleDateString('pt-BR');
    if (!tasksByMember[memberId][dateKey]) tasksByMember[memberId][dateKey] = [];
    tasksByMember[memberId][dateKey].push(task);
  }

  // Sort date groups ascending (oldest to newest)
  const sortedTasksByMember: Record<string, [string, any[]][]> = {};
  for (const [memberId, dateGroups] of Object.entries(tasksByMember)) {
    sortedTasksByMember[memberId] = Object.entries(dateGroups).sort((a, b) => {
      const parseDate = (dateStr: string) => {
        const [day, month, year] = dateStr.split('/').map(Number);
        return new Date(year, month - 1, day).getTime();
      };
      return parseDate(a[0]) - parseDate(b[0]);
    });
  }

  return (
    <ScrollArea className="h-[calc(100vh-400px)]">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(sortedTasksByMember).map(([memberId, sortedDateGroups]) => (
          <Card key={memberId} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getMemberAvatar(memberId)} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getMemberName(memberId).split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{getMemberName(memberId)}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {sortedDateGroups.reduce((sum, [, tasks]) => sum + tasks.length, 0)} atividades
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {sortedDateGroups.map(([date, dayTasks]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{date}</span>
                  </div>
                  <div className="space-y-2 pl-5 border-l-2 border-border">
                    {dayTasks.map((task: any) => (
                      <div key={task.id} className="p-2 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {statusLabels[task.status] || task.status}
                          </Badge>
                          <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[task.priority] || ''}`}>
                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baixa'}
                          </Badge>
                          {task.due_date && (
                            <span className="text-[10px] text-muted-foreground">
                              Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        {Object.keys(sortedTasksByMember).length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma atividade encontrada para os colaboradores da equipe.
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
