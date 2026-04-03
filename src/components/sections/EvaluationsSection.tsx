import { useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Plus, Search, BarChart3, Settings2, Users, FileText, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations, statusLabels, statusColors, classifyLabel, classifyColor, classifyScore } from '@/hooks/useEvaluations';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function EvaluationsSection() {
  const { profile, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const autonomy = profile?.autonomy_level || 'colaborador';
  const canManageStructure = isAdmin || autonomy === 'supervisor' || autonomy === 'diretoria';
  const canCreateEvaluations = isAdmin || autonomy === 'gerente' || autonomy === 'gestor' || autonomy === 'diretoria' || autonomy === 'supervisor';

  const {
    positions, competencies, cycles, evaluations, loading,
    createPosition, createCompetency, createCycle, createEvaluation,
    sendEvaluation, approveEvaluation, contestEvaluation, finalizeEvaluation,
    refreshData,
  } = useEvaluations();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [showNewCompetency, setShowNewCompetency] = useState(false);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewEval, setShowNewEval] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState<string | null>(null);
  const [showContestDialog, setShowContestDialog] = useState<string | null>(null);

  // Form states
  const [posName, setPosName] = useState('');
  const [posDesc, setPosDesc] = useState('');
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compCategory, setCompCategory] = useState('behavioral');
  const [cycleName, setCycleName] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [evalTarget, setEvalTarget] = useState('');
  const [evalCycle, setEvalCycle] = useState('');
  const [evalPosition, setEvalPosition] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [contestComment, setContestComment] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Filtered evaluations
  const myEvaluations = evaluations.filter(e => e.evaluated_id === profile?.id);
  const teamEvaluations = evaluations.filter(e => e.evaluator_id === profile?.id);
  const pendingCount = evaluations.filter(e => ['sent'].includes(e.status) && e.evaluated_id === profile?.id).length;
  const draftCount = evaluations.filter(e => ['draft', 'in_progress'].includes(e.status) && e.evaluator_id === profile?.id).length;
  const finalizedCount = evaluations.filter(e => e.status === 'finalized').length;

  const fetchTeamMembers = async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('id, name, display_name, email').eq('is_active', true).order('name');
    setTeamMembers(data || []);
  };

  const handleCreateEval = async () => {
    if (!evalTarget) { toast.error('Selecione o colaborador.'); return; }
    await createEvaluation({
      evaluated_id: evalTarget,
      cycle_id: evalCycle || undefined,
      position_id: evalPosition || undefined,
    });
    setShowNewEval(false);
    setEvalTarget('');
  };

  const handleApprove = async () => {
    if (!showApproveDialog) return;
    await approveEvaluation(showApproveDialog, approveComment || undefined);
    setShowApproveDialog(null);
    setApproveComment('');
  };

  const handleContest = async () => {
    if (!showContestDialog || !contestComment.trim()) { toast.error('Justificativa obrigatória.'); return; }
    await contestEvaluation(showContestDialog, contestComment);
    setShowContestDialog(null);
    setContestComment('');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Avaliações de Desempenho
          </h3>
          <p className="text-muted-foreground text-sm mt-1">Gestão de avaliações, competências e feedbacks</p>
        </div>
        {canCreateEvaluations && (
          <Button onClick={() => { fetchTeamMembers(); setShowNewEval(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Avaliação
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', value: pendingCount, icon: FileText, color: 'text-amber-500' },
          { label: 'Rascunhos', value: draftCount, icon: Settings2, color: 'text-blue-500' },
          { label: 'Finalizadas', value: finalizedCount, icon: BarChart3, color: 'text-green-500' },
          { label: 'Total', value: evaluations.length, icon: TrendingUp, color: 'text-primary' },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("rounded-full p-2 bg-muted", m.color)}>
                <m.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full", canManageStructure ? "grid-cols-4" : "grid-cols-3")}>
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="my-evals" className="text-xs">Minhas Avaliações</TabsTrigger>
          {canCreateEvaluations && <TabsTrigger value="team" className="text-xs">Equipe</TabsTrigger>}
          {canManageStructure && <TabsTrigger value="structure" className="text-xs">Estrutura</TabsTrigger>}
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas Avaliações</CardTitle></CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação encontrada.</p>
              ) : (
                <div className="space-y-2">
                  {evaluations.slice(0, 10).map(ev => (
                    <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{ev.evaluated_name}</p>
                          <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Avaliador: {ev.evaluator_name}
                          {ev.cycle_name && ` • Ciclo: ${ev.cycle_name}`}
                          {ev.overall_score != null && ` • Nota: ${ev.overall_score}`}
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Evaluations */}
        <TabsContent value="my-evals" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Avaliações Recebidas</CardTitle></CardHeader>
            <CardContent>
              {myEvaluations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação recebida.</p>
              ) : (
                <div className="space-y-2">
                  {myEvaluations.map(ev => (
                    <div key={ev.id} className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">Avaliador: {ev.evaluator_name} • {new Date(ev.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        {ev.overall_score != null && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">{ev.overall_score}</p>
                            <p className={cn("text-[10px]", classifyColor(classifyScore(ev.overall_score) || ''))}>{classifyLabel(classifyScore(ev.overall_score) || '')}</p>
                          </div>
                        )}
                      </div>
                      {ev.overall_comment && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{ev.overall_comment}</p>}
                      {ev.status === 'sent' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setShowApproveDialog(ev.id)} className="text-xs">Aprovar</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowContestDialog(ev.id)} className="text-xs text-destructive">Contestar</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        {canCreateEvaluations && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Avaliações da Equipe</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {teamEvaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação criada. Crie uma nova avaliação para sua equipe.</p>
                ) : (
                  <div className="space-y-2">
                    {teamEvaluations.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div>
                          <p className="text-sm font-medium text-foreground">{ev.evaluated_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                            {ev.overall_score != null && <span className="text-xs text-muted-foreground">Nota: {ev.overall_score}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {ev.status === 'draft' && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => sendEvaluation(ev.id)}>Enviar</Button>
                          )}
                          {(ev.status === 'approved' || ev.status === 'approved_with_obs') && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => finalizeEvaluation(ev.id)}>Finalizar</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Structure */}
        {canManageStructure && (
          <TabsContent value="structure" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Positions */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Cargos</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setPosName(''); setPosDesc(''); setShowNewPosition(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[250px]">
                    {positions.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum cargo cadastrado.</p> : (
                      <div className="space-y-1">{positions.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                          <span className="text-foreground">{p.name}</span>
                        </div>
                      ))}</div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Competencies */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Competências</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setCompName(''); setCompDesc(''); setShowNewCompetency(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[250px]">
                    {competencies.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma competência cadastrada.</p> : (
                      <div className="space-y-1">{competencies.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                          <span className="text-foreground">{c.name}</span>
                          <Badge variant="outline" className="text-[10px]">{c.category === 'technical' ? 'Técnica' : 'Comportamental'}</Badge>
                        </div>
                      ))}</div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Cycles */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Ciclos</CardTitle>
                    <Button size="sm" variant="ghost" onClick={() => { setCycleName(''); setCycleStart(''); setCycleEnd(''); setShowNewCycle(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[250px]">
                    {cycles.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum ciclo criado.</p> : (
                      <div className="space-y-1">{cycles.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                          <span className="text-foreground">{c.name}</span>
                          <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{c.status === 'active' ? 'Ativo' : 'Encerrado'}</Badge>
                        </div>
                      ))}</div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* New Position Dialog */}
      <Dialog open={showNewPosition} onOpenChange={setShowNewPosition}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Cargo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={posName} onChange={e => setPosName(e.target.value)} placeholder="Ex: Atendente" /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={posDesc} onChange={e => setPosDesc(e.target.value)} placeholder="Descrição do cargo" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPosition(false)}>Cancelar</Button>
            <Button onClick={() => { createPosition({ name: posName, description: posDesc }); setShowNewPosition(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Competency Dialog */}
      <Dialog open={showNewCompetency} onOpenChange={setShowNewCompetency}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Competência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Comunicação" /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={compDesc} onChange={e => setCompDesc(e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={compCategory} onValueChange={setCompCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavioral">Comportamental</SelectItem>
                  <SelectItem value="technical">Técnica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCompetency(false)}>Cancelar</Button>
            <Button onClick={() => { createCompetency({ name: compName, description: compDesc, category: compCategory }); setShowNewCompetency(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Cycle Dialog */}
      <Dialog open={showNewCycle} onOpenChange={setShowNewCycle}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Ciclo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="Ex: Avaliação Q1 2026" /></div>
            <div className="space-y-1"><Label className="text-xs">Data Início</Label><Input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Data Fim</Label><Input type="date" value={cycleEnd} onChange={e => setCycleEnd(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCycle(false)}>Cancelar</Button>
            <Button onClick={() => { createCycle({ name: cycleName, start_date: cycleStart, end_date: cycleEnd }); setShowNewCycle(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Evaluation Dialog */}
      <Dialog open={showNewEval} onOpenChange={setShowNewEval}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Colaborador</Label>
              <Select value={evalTarget} onValueChange={setEvalTarget}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {teamMembers.filter(m => m.id !== profile?.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name || m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ciclo (opcional)</Label>
              <Select value={evalCycle} onValueChange={setEvalCycle}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {cycles.filter(c => c.status === 'active').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo (opcional)</Label>
              <Select value={evalPosition} onValueChange={setEvalPosition}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEval(false)}>Cancelar</Button>
            <Button onClick={handleCreateEval}>Criar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!showApproveDialog} onOpenChange={() => setShowApproveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Aprovar Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} placeholder="Adicione uma observação se desejar..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(null)}>Cancelar</Button>
            <Button onClick={handleApprove}>Aprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contest Dialog */}
      <Dialog open={!!showContestDialog} onOpenChange={() => setShowContestDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-destructive">Contestar Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Justificativa (obrigatória)</Label>
            <Textarea value={contestComment} onChange={e => setContestComment(e.target.value)} placeholder="Descreva o motivo da contestação..." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContestDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleContest}>Contestar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
