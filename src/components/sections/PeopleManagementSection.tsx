import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Trash2, BarChart3, MessageSquare, ListTodo, Award, Search } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
        <TabsList>
          <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" /> Equipe</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /> Relatórios</TabsTrigger>
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
