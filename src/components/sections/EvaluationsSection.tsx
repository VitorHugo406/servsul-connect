import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Plus, Search, BarChart3, Settings2, Users, FileText, TrendingUp, Star, ThumbsUp, ThumbsDown, AlertTriangle, Eye, Send, Download, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations, statusLabels, statusColors, classifyLabel, classifyColor, classifyScore } from '@/hooks/useEvaluations';
import type { EvaluationItem } from '@/hooks/useEvaluations';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  LineChart, Line,
} from 'recharts';

export function EvaluationsSection() {
  const { profile, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const autonomy = profile?.autonomy_level || 'colaborador';
  const canManageStructure = isAdmin || autonomy === 'supervisor' || autonomy === 'diretoria';
  const canCreateEvaluations = isAdmin || autonomy === 'gerente' || autonomy === 'gestor' || autonomy === 'diretoria' || autonomy === 'supervisor';
  const isDirectoria = autonomy === 'diretoria' || isAdmin;

  const {
    positions, competencies, positionCompetencies, cycles, evaluations, loading,
    createPosition, createCompetency, createCycle, createEvaluation,
    sendEvaluation, approveEvaluation, contestEvaluation, respondToContestation, finalizeEvaluation,
    fetchEvaluationItems, saveEvaluationItems, fetchPositionCompetencies, savePositionCompetencies,
    fetchEvaluationHistory,
    refreshData,
  } = useEvaluations();

  const [activeTab, setActiveTab] = useState('dashboard');

  // Dialog states
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [showNewCompetency, setShowNewCompetency] = useState(false);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewEval, setShowNewEval] = useState(false);
  const [showEvalDetail, setShowEvalDetail] = useState<string | null>(null);
  const [showContestDialog, setShowContestDialog] = useState<string | null>(null);
  const [showRespondDialog, setShowRespondDialog] = useState<string | null>(null);
  const [showPosCompetencies, setShowPosCompetencies] = useState<string | null>(null);

  // Form states
  const [posName, setPosName] = useState('');
  const [posDesc, setPosDesc] = useState('');
  const [posSector, setPosSector] = useState('');
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compCategory, setCompCategory] = useState('behavioral');
  const [cycleName, setCycleName] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [evalTarget, setEvalTarget] = useState('');
  const [evalCycle, setEvalCycle] = useState('');
  const [evalPosition, setEvalPosition] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);

  // Evaluation detail states
  const [evalItems, setEvalItems] = useState<EvaluationItem[]>([]);
  const [editingItems, setEditingItems] = useState<{ competency_id: string; score: number | null; weight: number; evaluator_comment: string }[]>([]);
  const [overallComment, setOverallComment] = useState('');
  const [contestComment, setContestComment] = useState('');
  const [itemContestations, setItemContestations] = useState<Record<string, string>>({});
  const [respondComment, setRespondComment] = useState('');
  const [itemReplies, setItemReplies] = useState<Record<string, { reply: string; new_score?: number }>>({});
  const [posCompItems, setPosCompItems] = useState<{ competency_id: string; weight: number }[]>([]);

  // Filtered evaluations based on role
  const myEvaluations = evaluations.filter(e => e.evaluated_id === profile?.id);
  const teamEvaluations = useMemo(() => {
    if (isDirectoria) return evaluations; // Diretoria sees all
    return evaluations.filter(e => e.evaluator_id === profile?.id);
  }, [evaluations, profile, isDirectoria]);

  const pendingCount = evaluations.filter(e => e.status === 'sent' && e.evaluated_id === profile?.id).length;
  const draftCount = evaluations.filter(e => ['draft', 'in_progress'].includes(e.status) && e.evaluator_id === profile?.id).length;
  const contestedCount = evaluations.filter(e => e.status === 'contested' && e.evaluator_id === profile?.id).length;
  const finalizedCount = evaluations.filter(e => e.status === 'finalized').length;

  const fetchTeamMembers = async () => {
    if (!profile) return;
    // Only show team members the gestor is responsible for
    const { data: teamData } = await supabase.from('supervisor_team_members').select('member_profile_id').eq('supervisor_id', profile.user_id);
    const memberIds = (teamData || []).map(t => t.member_profile_id);

    let query = supabase.from('profiles').select('id, name, display_name, email, registration_number, sector_id, autonomy_level').eq('is_active', true);
    
    if (!isDirectoria && memberIds.length > 0) {
      query = query.in('id', memberIds);
    } else if (!isDirectoria) {
      query = query.neq('id', profile.id);
    }

    const { data } = await query.order('name');
    setTeamMembers(data || []);

    const { data: sectorData } = await supabase.from('sectors').select('id, name');
    setSectors(sectorData || []);
  };

  const openEvalDetail = async (evalId: string) => {
    const items = await fetchEvaluationItems(evalId);
    setEvalItems(items);
    const ev = evaluations.find(e => e.id === evalId);
    setOverallComment(ev?.overall_comment || '');

    // If gestor and draft/in_progress, set editing items
    if (ev && (ev.evaluator_id === profile?.id || isAdmin) && ['draft', 'in_progress'].includes(ev.status)) {
      if (items.length > 0) {
        setEditingItems(items.map(i => ({
          competency_id: i.competency_id,
          score: i.score,
          weight: i.weight,
          evaluator_comment: i.evaluator_comment || '',
        })));
      } else if (ev.position_id) {
        // Load from position competencies
        const posComps = await fetchPositionCompetencies(ev.position_id);
        setEditingItems(posComps.map(pc => ({
          competency_id: pc.competency_id,
          score: null,
          weight: pc.weight,
          evaluator_comment: '',
        })));
      }
    } else {
      setEditingItems([]);
    }

    setShowEvalDetail(evalId);
  };

  const handleSaveEvalItems = async () => {
    if (!showEvalDetail) return;
    await saveEvaluationItems(showEvalDetail, editingItems.map(i => ({
      ...i,
      evaluator_comment: i.evaluator_comment || undefined,
    })));
    const ev = evaluations.find(e => e.id === showEvalDetail);
    if (overallComment && ev) {
      await supabase.from('evaluations').update({ overall_comment: overallComment }).eq('id', showEvalDetail);
    }
    const updatedItems = await fetchEvaluationItems(showEvalDetail);
    setEvalItems(updatedItems);
    refreshData();
  };

  const handleSendFromDetail = async () => {
    if (!showEvalDetail) return;
    await handleSaveEvalItems();
    await sendEvaluation(showEvalDetail);
    setShowEvalDetail(null);
  };

  const handleContest = async () => {
    if (!showContestDialog || !contestComment.trim()) { toast.error('Justificativa obrigatória.'); return; }
    const contestations = Object.entries(itemContestations)
      .filter(([, v]) => v.trim())
      .map(([itemId, response]) => ({ item_id: itemId, response }));
    await contestEvaluation(showContestDialog, contestComment, contestations);
    setShowContestDialog(null);
    setContestComment('');
    setItemContestations({});
    setShowEvalDetail(null);
  };

  const handleRespond = async () => {
    if (!showRespondDialog || !respondComment.trim()) { toast.error('Resposta obrigatória.'); return; }
    const replies = Object.entries(itemReplies)
      .filter(([, v]) => v.reply.trim())
      .map(([itemId, v]) => ({ item_id: itemId, reply: v.reply, new_score: v.new_score }));
    await respondToContestation(showRespondDialog, respondComment, replies);
    setShowRespondDialog(null);
    setRespondComment('');
    setItemReplies({});
    setShowEvalDetail(null);
  };

  const getCompetencyName = (id: string) => competencies.find(c => c.id === id)?.name || id;

  // Group items by classification
  const groupItemsByClassification = (items: EvaluationItem[]) => {
    const excellent = items.filter(i => i.score != null && i.score >= 4);
    const good = items.filter(i => i.score != null && i.score === 3);
    const needsImprovement = items.filter(i => i.score != null && i.score <= 2);
    return { excellent, good, needsImprovement };
  };

  // Generate final report PDF
  const generateFinalReport = (ev: typeof evaluations[0], items: EvaluationItem[]) => {
    const doc = new jsPDF();
    const { excellent, good, needsImprovement } = groupItemsByClassification(items);
    
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('Relatório de Avaliação de Desempenho', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    let y = 40;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Colaborador: ${ev.evaluated_name}`, 14, y); y += 6;
    if (ev.evaluated_registration) { doc.text(`Matrícula: ${ev.evaluated_registration}`, 14, y); y += 6; }
    if (ev.evaluated_sector) { doc.text(`Setor: ${ev.evaluated_sector}`, 14, y); y += 6; }
    if (ev.position_name) { doc.text(`Cargo: ${ev.position_name}`, 14, y); y += 6; }
    doc.text(`Avaliador: ${ev.evaluator_name}`, 14, y); y += 6;
    if (ev.cycle_name) { doc.text(`Ciclo: ${ev.cycle_name}`, 14, y); y += 6; }
    doc.text(`Nota Final: ${ev.overall_score ?? '-'}`, 14, y); y += 6;
    doc.text(`Status: ${statusLabels[ev.status]}`, 14, y); y += 10;

    // Excellent
    if (excellent.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text('✅ Habilidades Excelentes', 14, y); y += 6;
      (doc as any).autoTable({
        startY: y, head: [['Competência', 'Nota', 'Observação']],
        body: excellent.map(i => [i.competency_name, `${i.score}/5`, i.evaluator_comment || '-']),
        styles: { fontSize: 9 }, headStyles: { fillColor: [22, 163, 74] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Good
    if (good.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(202, 138, 4);
      doc.text('👍 Habilidades Boas', 14, y); y += 6;
      (doc as any).autoTable({
        startY: y, head: [['Competência', 'Nota', 'Observação']],
        body: good.map(i => [i.competency_name, `${i.score}/5`, i.evaluator_comment || '-']),
        styles: { fontSize: 9 }, headStyles: { fillColor: [202, 138, 4] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Needs Improvement
    if (needsImprovement.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text('⚠️ Habilidades que Precisam Melhorar', 14, y); y += 6;
      (doc as any).autoTable({
        startY: y, head: [['Competência', 'Nota', 'Observação']],
        body: needsImprovement.map(i => [i.competency_name, `${i.score}/5`, i.evaluator_comment || '-']),
        styles: { fontSize: 9 }, headStyles: { fillColor: [220, 38, 38] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (ev.overall_comment) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Observação Geral:', 14, y); y += 6;
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(ev.overall_comment, 178);
      doc.text(lines, 14, y); y += lines.length * 4 + 10;
    }

    // Signature fields
    if (y > 240) { doc.addPage(); y = 20; }
    y += 20;
    doc.setDrawColor(150);
    doc.line(14, y, 90, y);
    doc.line(110, y, 196, y);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Avaliador', 42, y + 5);
    doc.text('Colaborador', 145, y + 5);

    doc.save(`avaliacao_${ev.evaluated_name?.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório gerado!');
  };

  // Generate full process report (with contestation history)
  const generateFullProcessReport = async (ev: typeof evaluations[0], items: EvaluationItem[]) => {
    const doc = new jsPDF();
    const history = await fetchEvaluationHistory(ev.id);
    const { excellent, good, needsImprovement } = groupItemsByClassification(items);
    
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text('Relatório Completo do Processo Avaliativo', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    let y = 40;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Colaborador: ${ev.evaluated_name}`, 14, y); y += 6;
    if (ev.evaluated_registration) { doc.text(`Matrícula: ${ev.evaluated_registration}`, 14, y); y += 6; }
    doc.text(`Avaliador: ${ev.evaluator_name}`, 14, y); y += 6;
    if (ev.position_name) { doc.text(`Cargo: ${ev.position_name}`, 14, y); y += 6; }
    doc.text(`Versão: ${ev.version}`, 14, y); y += 10;

    // All items table
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Avaliação por Competência', 14, y); y += 6;
    (doc as any).autoTable({
      startY: y,
      head: [['Competência', 'Nota', 'Classificação', 'Obs. Avaliador', 'Contestação', 'Resposta']],
      body: items.map(i => [
        i.competency_name, i.score ? `${i.score}/5` : '-',
        classifyLabel(classifyScore(i.score)),
        i.evaluator_comment || '-', i.evaluated_response || '-', i.evaluator_reply || '-'
      ]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 30 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 30 } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // History timeline
    if (history.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text('Histórico do Processo', 14, y); y += 6;
      (doc as any).autoTable({
        startY: y,
        head: [['Data', 'Ação', 'De', 'Para', 'Detalhes']],
        body: history.map(h => [
          new Date(h.created_at).toLocaleString('pt-BR'),
          h.action, h.old_status || '-', h.new_status || '-',
          h.details ? h.details.substring(0, 60) : '-'
        ]),
        styles: { fontSize: 8 }, headStyles: { fillColor: [100, 50, 150] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`processo_avaliacao_${ev.evaluated_name?.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório do processo gerado!');
  };

  // Dashboard data
  const dashboardScores = useMemo(() => {
    const finalized = evaluations.filter(e => e.status === 'finalized' && e.overall_score != null);
    if (finalized.length === 0) return [];
    return finalized.map(e => ({
      name: e.evaluated_name || '',
      score: e.overall_score || 0,
      cycle: e.cycle_name || 'Sem ciclo',
    }));
  }, [evaluations]);

  const avgScore = useMemo(() => {
    const scores = dashboardScores.map(d => d.score).filter(Boolean);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
  }, [dashboardScores]);

  // Render score stars
  const renderStars = (score: number | null, onChange?: (v: number) => void) => {
    const stars = [1, 2, 3, 4, 5];
    return (
      <div className="flex gap-0.5">
        {stars.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange?.(s)}
            disabled={!onChange}
            className={cn(
              "transition-colors",
              onChange ? "cursor-pointer hover:scale-110" : "cursor-default",
              s <= (score || 0) ? "text-amber-500" : "text-muted-foreground/30"
            )}
          >
            <Star className={cn("h-5 w-5", s <= (score || 0) && "fill-amber-500")} />
          </button>
        ))}
      </div>
    );
  };

  const currentEval = showEvalDetail ? evaluations.find(e => e.id === showEvalDetail) : null;
  const isEvaluator = currentEval?.evaluator_id === profile?.id || isAdmin;
  const isEvaluated = currentEval?.evaluated_id === profile?.id;
  const canEdit = isEvaluator && currentEval && ['draft', 'in_progress'].includes(currentEval.status);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Pendentes', value: pendingCount, icon: FileText, color: 'text-amber-500' },
          { label: 'Rascunhos', value: draftCount, icon: Settings2, color: 'text-blue-500' },
          { label: 'Contestadas', value: contestedCount, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Finalizadas', value: finalizedCount, icon: BarChart3, color: 'text-green-500' },
          { label: 'Nota Média', value: avgScore || '-', icon: TrendingUp, color: 'text-primary' },
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
        <TabsList className={cn("grid w-full", canManageStructure ? "grid-cols-4" : canCreateEvaluations ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
          <TabsTrigger value="my-evals" className="text-xs">Minhas Avaliações</TabsTrigger>
          {canCreateEvaluations && <TabsTrigger value="team" className="text-xs">Equipe</TabsTrigger>}
          {canManageStructure && <TabsTrigger value="structure" className="text-xs">Estrutura</TabsTrigger>}
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Score chart */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Notas por Colaborador</CardTitle></CardHeader>
              <CardContent>
                {dashboardScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação finalizada.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboardScores}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent evaluations */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Últimas Avaliações</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[250px]">
                  {evaluations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação.</p>
                  ) : (
                    <div className="space-y-2">
                      {evaluations.slice(0, 8).map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => openEvalDetail(ev.id)}
                          className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{ev.evaluated_name}</p>
                              <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ev.evaluator_name}{ev.overall_score != null && ` • ${ev.overall_score}/5`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
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
                    <div key={ev.id} className="p-4 rounded-xl border border-border space-y-3 hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Avaliador: {ev.evaluator_name} • {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                            {ev.position_name && ` • Cargo: ${ev.position_name}`}
                          </p>
                        </div>
                        {ev.overall_score != null && (
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">{ev.overall_score}</p>
                            <p className={cn("text-[10px] font-medium", classifyColor(classifyScore(ev.overall_score) || ''))}>{classifyLabel(classifyScore(ev.overall_score) || '')}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openEvalDetail(ev.id)}>
                          <Eye className="h-3.5 w-3.5" /> Ver Detalhes
                        </Button>
                        {ev.status === 'sent' && (
                          <>
                            <Button size="sm" className="text-xs gap-1" onClick={() => { openEvalDetail(ev.id).then(() => {}); }}>
                              <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => { openEvalDetail(ev.id).then(() => {}); }}>
                              <ThumbsDown className="h-3.5 w-3.5" /> Contestar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evolution chart */}
          {myEvaluations.filter(e => e.overall_score != null).length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Minha Evolução</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={myEvaluations.filter(e => e.overall_score != null).reverse().map(e => ({
                    date: new Date(e.created_at).toLocaleDateString('pt-BR'),
                    score: e.overall_score,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team */}
        {canCreateEvaluations && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avaliações da Equipe</CardTitle>
              </CardHeader>
              <CardContent>
                {teamEvaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação criada.</p>
                ) : (
                  <div className="space-y-2">
                    {teamEvaluations.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{ev.evaluated_name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
                            {ev.position_name && <span className="text-xs text-muted-foreground">{ev.position_name}</span>}
                            {ev.overall_score != null && <span className="text-xs font-medium text-foreground">{ev.overall_score}/5</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEvalDetail(ev.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {ev.status === 'draft' && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => openEvalDetail(ev.id)}>Editar</Button>
                          )}
                          {ev.status === 'contested' && (
                            <Button size="sm" variant="outline" className="text-xs text-amber-600" onClick={() => openEvalDetail(ev.id)}>Responder</Button>
                          )}
                          {(ev.status === 'approved' || ev.status === 'approved_with_obs') && (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => finalizeEvaluation(ev.id)}>Finalizar</Button>
                          )}
                          {ev.status === 'finalized' && (
                            <Button size="sm" variant="ghost" className="text-xs" onClick={async () => {
                              const items = await fetchEvaluationItems(ev.id);
                              generateFinalReport(ev, items);
                            }}>
                              <Download className="h-4 w-4" />
                            </Button>
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
                  <ScrollArea className="max-h-[300px]">
                    {positions.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum cargo.</p> : (
                      <div className="space-y-1">{positions.map(p => {
                        const compCount = positionCompetencies.filter(pc => pc.position_id === p.id).length;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setShowPosCompetencies(p.id);
                              fetchPositionCompetencies(p.id).then(pcs => {
                                setPosCompItems(pcs.map(pc => ({ competency_id: pc.competency_id, weight: pc.weight })));
                              });
                            }}
                            className="flex items-center justify-between w-full p-2 rounded hover:bg-muted/50 text-sm text-left"
                          >
                            <span className="text-foreground">{p.name}</span>
                            <Badge variant="outline" className="text-[10px]">{compCount} comp.</Badge>
                          </button>
                        );
                      })}</div>
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
                  <ScrollArea className="max-h-[300px]">
                    {competencies.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma competência.</p> : (
                      <div className="space-y-1">{competencies.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                          <div>
                            <span className="text-foreground">{c.name}</span>
                            {c.description && <p className="text-[10px] text-muted-foreground">{c.description}</p>}
                          </div>
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
                  <ScrollArea className="max-h-[300px]">
                    {cycles.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum ciclo.</p> : (
                      <div className="space-y-1">{cycles.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm">
                          <div>
                            <span className="text-foreground">{c.name}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(c.start_date).toLocaleDateString('pt-BR')} — {new Date(c.end_date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
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

      {/* ===== DIALOGS ===== */}

      {/* New Position */}
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

      {/* New Competency */}
      <Dialog open={showNewCompetency} onOpenChange={setShowNewCompetency}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Competência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Comunicação" /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Textarea value={compDesc} onChange={e => setCompDesc(e.target.value)} placeholder="Descreva a competência..." rows={2} /></div>
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

      {/* New Cycle */}
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

      {/* New Evaluation */}
      <Dialog open={showNewEval} onOpenChange={setShowNewEval}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Colaborador</Label>
              <Select value={evalTarget} onValueChange={setEvalTarget}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {teamMembers.filter(m => m.id !== profile?.id).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name || m.name} {m.registration_number && `(${m.registration_number})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo (competências serão carregadas automaticamente)</Label>
              <Select value={evalPosition} onValueChange={setEvalPosition}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEval(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!evalTarget) { toast.error('Selecione o colaborador.'); return; }
              if (!evalPosition) { toast.error('Selecione o cargo.'); return; }
              await createEvaluation({ evaluated_id: evalTarget, cycle_id: evalCycle || undefined, position_id: evalPosition || undefined });
              setShowNewEval(false);
              setEvalTarget(''); setEvalCycle(''); setEvalPosition('');
            }}>Criar Avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Competencies Dialog */}
      <Dialog open={!!showPosCompetencies} onOpenChange={() => setShowPosCompetencies(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Competências do Cargo: {positions.find(p => p.id === showPosCompetencies)?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-2">
              {posCompItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded border border-border">
                  <div className="flex-1">
                    <Select value={item.competency_id} onValueChange={v => {
                      const next = [...posCompItems];
                      next[idx].competency_id = v;
                      setPosCompItems(next);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Competência" /></SelectTrigger>
                      <SelectContent>
                        {competencies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input type="number" min={1} max={10} value={item.weight} onChange={e => {
                      const next = [...posCompItems];
                      next[idx].weight = Number(e.target.value);
                      setPosCompItems(next);
                    }} className="h-8 text-xs" placeholder="Peso" />
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                    setPosCompItems(posCompItems.filter((_, i) => i !== idx));
                  }}>✕</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="text-xs w-full" onClick={() => setPosCompItems([...posCompItems, { competency_id: '', weight: 1 }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Competência
              </Button>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPosCompetencies(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!showPosCompetencies) return;
              const valid = posCompItems.filter(i => i.competency_id);
              await savePositionCompetencies(showPosCompetencies, valid);
              setShowPosCompetencies(null);
              refreshData();
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Evaluation Detail Dialog ===== */}
      <Dialog open={!!showEvalDetail} onOpenChange={() => setShowEvalDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {currentEval && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  Avaliação: {currentEval.evaluated_name}
                  <Badge className={cn("text-[10px]", statusColors[currentEval.status])}>{statusLabels[currentEval.status]}</Badge>
                </DialogTitle>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {currentEval.evaluated_registration && <p>Matrícula: {currentEval.evaluated_registration}</p>}
                  {currentEval.position_name && <p>Cargo: {currentEval.position_name}</p>}
                  {currentEval.evaluated_sector && <p>Setor: {currentEval.evaluated_sector}</p>}
                  <p>Avaliador: {currentEval.evaluator_name} • Versão: {currentEval.version}</p>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-4 pb-4">
                  {/* Editing mode for evaluator */}
                  {canEdit && editingItems.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Avaliar Competências</h4>
                      {editingItems.map((item, idx) => {
                        const comp = competencies.find(c => c.id === item.competency_id);
                        return (
                          <Card key={idx} className="border-border">
                            <CardContent className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{comp?.name || 'Competência'}</p>
                                  {comp?.description && <p className="text-[10px] text-muted-foreground">{comp.description}</p>}
                                </div>
                                <Badge variant="outline" className="text-[10px]">Peso: {item.weight}</Badge>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">Nota:</span>
                                {renderStars(item.score, (v) => {
                                  const next = [...editingItems];
                                  next[idx].score = v;
                                  setEditingItems(next);
                                })}
                                {item.score && (
                                  <Badge className={cn("text-[10px]", classifyColor(classifyScore(item.score)))}>{classifyLabel(classifyScore(item.score))}</Badge>
                                )}
                              </div>
                              <Textarea
                                value={item.evaluator_comment}
                                onChange={e => {
                                  const next = [...editingItems];
                                  next[idx].evaluator_comment = e.target.value;
                                  setEditingItems(next);
                                }}
                                placeholder="Observação sobre esta competência..."
                                rows={2}
                                className="text-xs"
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                      <div className="space-y-1">
                        <Label className="text-xs">Observação Geral</Label>
                        <Textarea value={overallComment} onChange={e => setOverallComment(e.target.value)} placeholder="Comentário geral sobre o colaborador..." rows={3} />
                      </div>
                      <div className="flex gap-2">
                        <Button className="gap-1" onClick={handleSaveEvalItems}><FileText className="h-4 w-4" /> Salvar Rascunho</Button>
                        <Button variant="secondary" className="gap-1" onClick={handleSendFromDetail}><Send className="h-4 w-4" /> Enviar para Ciência</Button>
                      </div>
                    </div>
                  )}

                  {/* Read-only view */}
                  {!canEdit && evalItems.length > 0 && (
                    <div className="space-y-3">
                      {/* Grouped by classification */}
                      {(() => {
                        const { excellent, good, needsImprovement } = groupItemsByClassification(evalItems);
                        return (
                          <>
                            {excellent.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-green-600 flex items-center gap-1 mb-2"><Star className="h-4 w-4" /> Excelente ({excellent.length})</h4>
                                {excellent.map(i => (
                                  <div key={i.id} className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 mb-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-foreground">{i.competency_name}</p>
                                      {renderStars(i.score)}
                                    </div>
                                    {i.evaluator_comment && <p className="text-xs text-muted-foreground mt-1">💬 {i.evaluator_comment}</p>}
                                    {i.evaluated_response && <p className="text-xs text-destructive mt-1 bg-destructive/5 rounded p-1">⚠️ Contestação: {i.evaluated_response}</p>}
                                    {i.evaluator_reply && <p className="text-xs text-primary mt-1 bg-primary/5 rounded p-1">↩️ Resposta: {i.evaluator_reply}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {good.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-1 mb-2"><ThumbsUp className="h-4 w-4" /> Bom ({good.length})</h4>
                                {good.map(i => (
                                  <div key={i.id} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 mb-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-foreground">{i.competency_name}</p>
                                      {renderStars(i.score)}
                                    </div>
                                    {i.evaluator_comment && <p className="text-xs text-muted-foreground mt-1">💬 {i.evaluator_comment}</p>}
                                    {i.evaluated_response && <p className="text-xs text-destructive mt-1 bg-destructive/5 rounded p-1">⚠️ Contestação: {i.evaluated_response}</p>}
                                    {i.evaluator_reply && <p className="text-xs text-primary mt-1 bg-primary/5 rounded p-1">↩️ Resposta: {i.evaluator_reply}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {needsImprovement.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-destructive flex items-center gap-1 mb-2"><AlertTriangle className="h-4 w-4" /> Precisa Melhorar ({needsImprovement.length})</h4>
                                {needsImprovement.map(i => (
                                  <div key={i.id} className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 mb-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-foreground">{i.competency_name}</p>
                                      {renderStars(i.score)}
                                    </div>
                                    {i.evaluator_comment && <p className="text-xs text-muted-foreground mt-1">💬 {i.evaluator_comment}</p>}
                                    {i.evaluated_response && <p className="text-xs text-destructive mt-1 bg-destructive/5 rounded p-1">⚠️ Contestação: {i.evaluated_response}</p>}
                                    {i.evaluator_reply && <p className="text-xs text-primary mt-1 bg-primary/5 rounded p-1">↩️ Resposta: {i.evaluator_reply}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Unrated */}
                            {evalItems.filter(i => i.score == null).length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Sem Avaliação</h4>
                                {evalItems.filter(i => i.score == null).map(i => (
                                  <div key={i.id} className="p-3 rounded-lg border border-border mb-2">
                                    <p className="text-sm font-medium text-foreground">{i.competency_name}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {currentEval.overall_comment && (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Observação Geral do Avaliador</p>
                          <p className="text-sm text-foreground">{currentEval.overall_comment}</p>
                        </div>
                      )}
                      {currentEval.evaluated_comment && (
                        <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-medium text-amber-600 mb-1">Observação do Colaborador</p>
                          <p className="text-sm text-foreground">{currentEval.evaluated_comment}</p>
                        </div>
                      )}
                      {currentEval.evaluator_response && (
                        <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-medium text-blue-600 mb-1">Resposta do Avaliador</p>
                          <p className="text-sm text-foreground">{currentEval.evaluator_response}</p>
                        </div>
                      )}

                      {/* Score summary */}
                      {currentEval.overall_score != null && (
                        <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                          <div className="text-center">
                            <p className="text-3xl font-bold text-foreground">{currentEval.overall_score}</p>
                            <p className={cn("text-sm font-medium", classifyColor(classifyScore(currentEval.overall_score) || ''))}>
                              {classifyLabel(classifyScore(currentEval.overall_score) || '')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons based on status and role */}
                  <Separator />
                  <div className="flex gap-2 flex-wrap">
                    {/* Evaluated can approve/contest when status is 'sent' */}
                    {isEvaluated && currentEval.status === 'sent' && (
                      <>
                        <Button size="sm" className="gap-1" onClick={async () => {
                          await approveEvaluation(currentEval.id);
                          setShowEvalDetail(null);
                        }}>
                          <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                          await approveEvaluation(currentEval.id, 'Aprovada com observação');
                          setShowEvalDetail(null);
                        }}>
                          Aprovar com Observação
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                          setItemContestations({});
                          setContestComment('');
                          setShowContestDialog(currentEval.id);
                        }}>
                          <ThumbsDown className="h-3.5 w-3.5" /> Contestar
                        </Button>
                      </>
                    )}

                    {/* Evaluator can respond to contestation */}
                    {isEvaluator && currentEval.status === 'contested' && (
                      <Button size="sm" variant="outline" className="gap-1 text-amber-600" onClick={() => {
                        setItemReplies({});
                        setRespondComment('');
                        setShowRespondDialog(currentEval.id);
                      }}>
                        <MessageSquare className="h-3.5 w-3.5" /> Responder Contestação
                      </Button>
                    )}

                    {/* Evaluator can finalize approved evals */}
                    {isEvaluator && ['approved', 'approved_with_obs'].includes(currentEval.status) && (
                      <Button size="sm" className="gap-1" onClick={async () => {
                        await finalizeEvaluation(currentEval.id);
                        setShowEvalDetail(null);
                      }}>
                        <ClipboardCheck className="h-3.5 w-3.5" /> Finalizar
                      </Button>
                    )}

                    {/* Reports */}
                    {currentEval.status === 'finalized' && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => generateFinalReport(currentEval, evalItems)}>
                          <Download className="h-3.5 w-3.5" /> Relatório Final
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => generateFullProcessReport(currentEval, evalItems)}>
                          <Download className="h-3.5 w-3.5" /> Relatório Completo
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Contest Dialog */}
      <Dialog open={!!showContestDialog} onOpenChange={() => setShowContestDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="text-destructive">Contestar Avaliação</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 pb-4">
              <p className="text-xs text-muted-foreground">Você pode contestar competências específicas ou deixar uma observação geral.</p>
              
              {/* Per-item contestation */}
              {evalItems.filter(i => i.score != null).map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{item.competency_name}</p>
                    <div className="flex items-center gap-2">
                      {renderStars(item.score)}
                      <Badge className={cn("text-[10px]", classifyColor(classifyScore(item.score) || ''))}>{classifyLabel(classifyScore(item.score) || '')}</Badge>
                    </div>
                  </div>
                  {item.evaluator_comment && <p className="text-xs text-muted-foreground">💬 {item.evaluator_comment}</p>}
                  <Textarea
                    value={itemContestations[item.id] || ''}
                    onChange={e => setItemContestations(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Contestar esta competência (opcional)..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              ))}

              <Separator />
              <div className="space-y-1">
                <Label className="text-xs font-medium text-destructive">Justificativa Geral (obrigatória)</Label>
                <Textarea value={contestComment} onChange={e => setContestComment(e.target.value)} placeholder="Descreva o motivo da contestação..." rows={3} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContestDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleContest}>Contestar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond to Contestation Dialog */}
      <Dialog open={!!showRespondDialog} onOpenChange={() => setShowRespondDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="text-amber-600">Responder Contestação</DialogTitle></DialogHeader>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 pb-4">
              <p className="text-xs text-muted-foreground">Revise as contestações do colaborador e responda. Você pode ajustar notas se necessário.</p>

              {evalItems.filter(i => i.evaluated_response).map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{item.competency_name}</p>
                    {renderStars(item.score)}
                  </div>
                  <p className="text-xs text-destructive bg-destructive/5 rounded p-2">⚠️ Contestação: {item.evaluated_response}</p>
                  <Textarea
                    value={itemReplies[item.id]?.reply || ''}
                    onChange={e => setItemReplies(prev => ({
                      ...prev,
                      [item.id]: { ...prev[item.id], reply: e.target.value },
                    }))}
                    placeholder="Sua resposta para esta contestação..."
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px]">Ajustar nota?</Label>
                    <Select
                      value={String(itemReplies[item.id]?.new_score || item.score || '')}
                      onValueChange={v => setItemReplies(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id] || { reply: '' }, new_score: Number(v) },
                      }))}
                    >
                      <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <Separator />
              <div className="space-y-1">
                <Label className="text-xs font-medium">Resposta Geral (obrigatória)</Label>
                <Textarea value={respondComment} onChange={e => setRespondComment(e.target.value)} placeholder="Sua resposta à contestação..." rows={3} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRespondDialog(null)}>Cancelar</Button>
            <Button onClick={handleRespond}>Enviar Resposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
