import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Plus, Search, BarChart3, Settings2, Users, FileText, TrendingUp, Star, ThumbsUp, ThumbsDown, AlertTriangle, Eye, Send, Download, ChevronDown, ChevronUp, MessageSquare, Clock, Edit2, Trash2, Bell, CheckCircle2 } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations, statusLabels, statusColors, classifyLabel, classifyColor, classifyScore } from '@/hooks/useEvaluations';
import type { EvaluationItem, Evaluation } from '@/hooks/useEvaluations';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import appLogo from '@/assets/app-logo.png';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(262, 83%, 58%)', 'hsl(221, 83%, 53%)'];

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
    updateEvaluation, sendEvaluation, approveEvaluation, contestEvaluation, respondToContestation, finalizeEvaluation,
    fetchEvaluationItems, saveEvaluationItems, fetchPositionCompetencies, savePositionCompetencies,
    fetchEvaluationHistory,
    refreshData,
    updatePosition, deletePosition, updateCompetency, deleteCompetency, updateCycle, deleteCycle,
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
  const [showEditPosition, setShowEditPosition] = useState<string | null>(null);
  const [showEditCompetency, setShowEditCompetency] = useState<string | null>(null);
  const [showEditCycle, setShowEditCycle] = useState<string | null>(null);

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
  const [cycleDesc, setCycleDesc] = useState('');
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

  // Dashboard filter
  const [dashDateFrom, setDashDateFrom] = useState('');
  const [dashDateTo, setDashDateTo] = useState('');

  // Pendencies sub-tab — regular users only see "Para Aprovar" / "Contestadas"
  const [pendencyTab, setPendencyTab] = useState(canCreateEvaluations ? 'to-evaluate' : 'awaiting-approval');

  // Filtered evaluations based on role
  const myEvaluations = evaluations.filter(e => e.evaluated_id === profile?.id);
  const teamEvaluations = useMemo(() => {
    if (isDirectoria) return evaluations;
    return evaluations.filter(e => e.evaluator_id === profile?.id);
  }, [evaluations, profile, isDirectoria]);

  // Pendency counts
  const pendingApproval = evaluations.filter(e => e.status === 'sent' && e.evaluated_id === profile?.id);
  const toEvaluate = evaluations.filter(e => ['draft', 'in_progress'].includes(e.status) && e.evaluator_id === profile?.id);
  // For evaluators: contested evaluations they need to respond to
  // For regular users: their own contested evaluations awaiting evaluator response
  const contested = canCreateEvaluations
    ? evaluations.filter(e => e.status === 'contested' && e.evaluator_id === profile?.id)
    : evaluations.filter(e => e.status === 'contested' && e.evaluated_id === profile?.id);
  const awaitingFinalization = evaluations.filter(e => ['approved', 'approved_with_obs'].includes(e.status) && e.evaluator_id === profile?.id);

  const totalPendencies = canCreateEvaluations
    ? pendingApproval.length + toEvaluate.length + contested.length + awaitingFinalization.length
    : pendingApproval.length + contested.length;

  const draftCount = toEvaluate.length;
  const pendingCount = pendingApproval.length;
  const contestedCount = contested.length;
  const finalizedCount = evaluations.filter(e => e.status === 'finalized').length;

  const fetchTeamMembers = async () => {
    if (!profile) return;
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

    if (ev && (ev.evaluator_id === profile?.id || isAdmin) && ['draft', 'in_progress'].includes(ev.status)) {
      if (items.length > 0) {
        setEditingItems(items.map(i => ({
          competency_id: i.competency_id,
          score: i.score,
          weight: i.weight,
          evaluator_comment: i.evaluator_comment || '',
        })));
      } else if (ev.position_id) {
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

  const groupItemsByClassification = (items: EvaluationItem[]) => {
    const excellent = items.filter(i => i.score != null && i.score >= 4);
    const good = items.filter(i => i.score != null && i.score === 3);
    const needsImprovement = items.filter(i => i.score != null && i.score <= 2);
    return { excellent, good, needsImprovement };
  };

  // ======= PDF GENERATION =======
  const addPdfHeader = (doc: jsPDF, title: string) => {
    // System logo
    try {
      doc.addImage(appLogo, 'PNG', 14, 10, 16, 16);
    } catch (e) {
      // fallback if image fails to load
      doc.setFillColor(37, 99, 235);
      doc.circle(22, 18, 8, 'F');
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('ServChat', 32, 15);
    doc.setFontSize(7);
    doc.text('Plataforma de Gestão', 32, 19);

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 14, 38);

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 44);

    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.line(14, 47, 196, 47);

    return 54;
  };

  const addPdfFooter = (doc: jsPDF, pageNum: number) => {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, h - 15, 196, h - 15);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('ServChat • Avaliação de Desempenho', 14, h - 10);
    doc.text(`Página ${pageNum}`, 185, h - 10);
  };

  const generateFinalReport = (ev: Evaluation, items: EvaluationItem[]) => {
    const doc = new jsPDF();
    const { excellent, good, needsImprovement } = groupItemsByClassification(items);

    let y = addPdfHeader(doc, 'Relatório de Avaliação de Desempenho');
    let pageNum = 1;
    addPdfFooter(doc, pageNum);

    // Info block
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 36, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    y += 7;
    doc.text(`Colaborador: ${ev.evaluated_name}`, 18, y);
    if (ev.evaluated_registration) { doc.text(`Matrícula: ${ev.evaluated_registration}`, 120, y); }
    y += 5;
    if (ev.evaluated_sector) doc.text(`Setor: ${ev.evaluated_sector}`, 18, y);
    if (ev.position_name) doc.text(`Cargo: ${ev.position_name}`, 120, y);
    y += 5;
    doc.text(`Avaliador: ${ev.evaluator_name}`, 18, y);
    if (ev.cycle_name) doc.text(`Ciclo: ${ev.cycle_name}`, 120, y);
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(234, 88, 12);
    doc.text(`Nota Final: ${ev.overall_score ?? '-'}/5`, 18, y);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Status: ${statusLabels[ev.status]}`, 120, y);
    y += 12;

    const checkPage = (needed: number) => {
      if (y + needed > 265) { doc.addPage(); pageNum++; addPdfFooter(doc, pageNum); y = 20; }
    };

    // Excellent
    if (excellent.length > 0) {
      checkPage(20);
      doc.setFontSize(11);
      doc.setTextColor(22, 163, 74);
      doc.text('★ Habilidades Excelentes', 14, y); y += 5;
      autoTable(doc, {
        startY: y, head: [['Competência', 'Nota', 'Peso', 'Observação']],
        body: excellent.map(i => [i.competency_name, `${i.score}/5`, String(i.weight), i.evaluator_comment || '-']),
        styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [22, 163, 74] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (good.length > 0) {
      checkPage(20);
      doc.setFontSize(11);
      doc.setTextColor(202, 138, 4);
      doc.text('● Habilidades Boas', 14, y); y += 5;
      autoTable(doc, {
        startY: y, head: [['Competência', 'Nota', 'Peso', 'Observação']],
        body: good.map(i => [i.competency_name, `${i.score}/5`, String(i.weight), i.evaluator_comment || '-']),
        styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [202, 138, 4] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (needsImprovement.length > 0) {
      checkPage(20);
      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text('▲ Habilidades que Precisam Melhorar', 14, y); y += 5;
      autoTable(doc, {
        startY: y, head: [['Competência', 'Nota', 'Peso', 'Observação']],
        body: needsImprovement.map(i => [i.competency_name, `${i.score}/5`, String(i.weight), i.evaluator_comment || '-']),
        styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [220, 38, 38] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (ev.overall_comment) {
      checkPage(25);
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Observação Geral:', 14, y); y += 5;
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(ev.overall_comment, 178);
      doc.text(lines, 14, y); y += lines.length * 4 + 8;
    }

    // Signature
    checkPage(30);
    y += 15;
    doc.setDrawColor(150);
    doc.line(14, y, 90, y);
    doc.line(110, y, 196, y);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Avaliador', 42, y + 5);
    doc.text('Colaborador', 145, y + 5);
    y += 8;
    doc.setFontSize(7);
    doc.text(ev.evaluator_name || '', 30, y + 4);
    doc.text(ev.evaluated_name || '', 133, y + 4);

    doc.save(`avaliacao_${ev.evaluated_name?.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório final gerado!');
  };

  const generateFullProcessReport = async (ev: Evaluation, items: EvaluationItem[]) => {
    const doc = new jsPDF();
    const history = await fetchEvaluationHistory(ev.id);
    const { excellent, good, needsImprovement } = groupItemsByClassification(items);

    let y = addPdfHeader(doc, 'Relatório Completo do Processo Avaliativo');
    let pageNum = 1;
    addPdfFooter(doc, pageNum);

    const checkPage = (needed: number) => {
      if (y + needed > 265) { doc.addPage(); pageNum++; addPdfFooter(doc, pageNum); y = 20; }
    };

    // Info block
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 28, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    y += 7;
    doc.text(`Colaborador: ${ev.evaluated_name}`, 18, y);
    if (ev.evaluated_registration) doc.text(`Matrícula: ${ev.evaluated_registration}`, 120, y);
    y += 5;
    doc.text(`Avaliador: ${ev.evaluator_name}`, 18, y);
    if (ev.position_name) doc.text(`Cargo: ${ev.position_name}`, 120, y);
    y += 5;
    doc.text(`Versão: ${ev.version}`, 18, y);
    doc.text(`Nota: ${ev.overall_score ?? '-'}/5`, 120, y);
    y += 12;

    // Full items table
    checkPage(20);
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Avaliação por Competência', 14, y); y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Competência', 'Nota', 'Class.', 'Obs. Avaliador', 'Contestação', 'Resposta']],
      body: items.map(i => [
        i.competency_name, i.score ? `${i.score}/5` : '-',
        classifyLabel(classifyScore(i.score)),
        i.evaluator_comment || '-', i.evaluated_response || '-', i.evaluator_reply || '-'
      ]),
      styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 28 }, 5: { cellWidth: 28 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Comments
    if (ev.overall_comment) {
      checkPage(20);
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(14, y, 182, 14, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text('Obs. Geral do Avaliador:', 16, y + 5);
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(ev.overall_comment, 174);
      doc.text(lines, 16, y + 9);
      y += 16;
    }

    if (ev.evaluated_comment) {
      checkPage(20);
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(14, y, 182, 14, 2, 2, 'F');
      doc.setFontSize(8);
      doc.text('Obs. do Colaborador:', 16, y + 5);
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(ev.evaluated_comment, 174);
      doc.text(lines, 16, y + 9);
      y += 16;
    }

    if (ev.evaluator_response) {
      checkPage(20);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(14, y, 182, 14, 2, 2, 'F');
      doc.setFontSize(8);
      doc.text('Resposta do Avaliador:', 16, y + 5);
      doc.setFontSize(7);
      const lines = doc.splitTextToSize(ev.evaluator_response, 174);
      doc.text(lines, 16, y + 9);
      y += 16;
    }

    // History
    if (history.length > 0) {
      checkPage(30);
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text('Histórico do Processo', 14, y); y += 5;
      autoTable(doc, {
        startY: y,
        head: [['Data', 'Ação', 'De', 'Para', 'Detalhes']],
        body: history.map(h => [
          new Date(h.created_at).toLocaleString('pt-BR'),
          h.action, h.old_status || '-', h.new_status || '-',
          h.details ? h.details.substring(0, 80) : '-'
        ]),
        styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [100, 50, 150] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`processo_avaliacao_${ev.evaluated_name?.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório do processo gerado!');
  };

  // ======= DASHBOARD DATA =======
  const dashboardScores = useMemo(() => {
    const finalized = evaluations.filter(e => {
      if (e.status !== 'finalized' || e.overall_score == null) return false;
      if (dashDateFrom && new Date(e.created_at) < new Date(dashDateFrom)) return false;
      if (dashDateTo && new Date(e.created_at) > new Date(dashDateTo + 'T23:59:59')) return false;
      return true;
    });
    return finalized;
  }, [evaluations, dashDateFrom, dashDateTo]);

  // Average score per employee month-to-month
  const monthlyAvgByEmployee = useMemo(() => {
    const finalized = evaluations.filter(e => e.status === 'finalized' && e.overall_score != null);
    const monthMap = new Map<string, { name: string; scores: number[] }>();
    finalized.forEach(e => {
      const month = e.created_at.slice(0, 7); // YYYY-MM
      const key = `${e.evaluated_name}|${month}`;
      if (!monthMap.has(key)) monthMap.set(key, { name: e.evaluated_name || '', scores: [] });
      monthMap.get(key)!.scores.push(e.overall_score!);
    });

    const months = [...new Set(finalized.map(e => e.created_at.slice(0, 7)))].sort();
    const employees = [...new Set(finalized.map(e => e.evaluated_name || ''))];

    return months.map(m => {
      const entry: any = { month: m.slice(5) + '/' + m.slice(0, 4) };
      employees.forEach(emp => {
        const key = `${emp}|${m}`;
        const data = monthMap.get(key);
        entry[emp] = data ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100) / 100 : null;
      });
      return entry;
    });
  }, [evaluations]);

  const employeeNames = useMemo(() => {
    return [...new Set(evaluations.filter(e => e.status === 'finalized' && e.overall_score != null).map(e => e.evaluated_name || ''))];
  }, [evaluations]);

  const avgScore = useMemo(() => {
    const scores = dashboardScores.map(d => d.overall_score!).filter(Boolean);
    return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
  }, [dashboardScores]);

  // Classification distribution for pie chart
  const classDistribution = useMemo(() => {
    const counts = { excellent: 0, good: 0, needs_improvement: 0 };
    dashboardScores.forEach(e => {
      const c = classifyScore(e.overall_score);
      if (c === 'excellent') counts.excellent++;
      else if (c === 'good') counts.good++;
      else if (c === 'needs_improvement') counts.needs_improvement++;
    });
    return [
      { name: 'Excelente', value: counts.excellent, color: 'hsl(142, 76%, 36%)' },
      { name: 'Bom', value: counts.good, color: 'hsl(38, 92%, 50%)' },
      { name: 'Precisa Melhorar', value: counts.needs_improvement, color: 'hsl(0, 72%, 51%)' },
    ].filter(d => d.value > 0);
  }, [dashboardScores]);

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

  // Render evaluation card list
  const renderEvalCard = (ev: Evaluation, showActions = true) => (
    <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{ev.evaluated_name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge className={cn("text-[10px]", statusColors[ev.status])}>{statusLabels[ev.status]}</Badge>
          {ev.position_name && <span className="text-xs text-muted-foreground">{ev.position_name}</span>}
          {ev.overall_score != null && <span className="text-xs font-medium text-foreground">{ev.overall_score}/5</span>}
          <span className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      {showActions && (
        <div className="flex gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEvalDetail(ev.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {ev.status === 'contested' && ev.evaluator_id === profile?.id && (
            <Button size="sm" variant="outline" className="text-xs text-amber-600" onClick={() => openEvalDetail(ev.id)}>Responder</Button>
          )}
          {['approved', 'approved_with_obs'].includes(ev.status) && ev.evaluator_id === profile?.id && (
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
      )}
    </div>
  );

  // Number of tabs
  const tabCount = 2 + (canCreateEvaluations ? 1 : 0) + (canManageStructure ? 1 : 0) + 1; // +1 for pendencies

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
          { label: 'Pendências', value: totalPendencies, icon: Bell, color: 'text-amber-500' },
          { label: 'Rascunhos', value: draftCount, icon: Settings2, color: 'text-blue-500' },
          { label: 'Contestadas', value: contestedCount, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Finalizadas', value: finalizedCount, icon: BarChart3, color: 'text-green-500' },
          { label: 'Nota Média', value: avgScore || '-', icon: TrendingUp, color: 'text-primary' },
        ].map(m => (
          <Card key={m.label} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => m.label === 'Pendências' && setActiveTab('pendencies')}>
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
        <ScrollArea className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
            <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="pendencies" className="text-xs relative">
              Pendências
              {totalPendencies > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground flex items-center justify-center">{totalPendencies}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-evals" className="text-xs">Minhas Avaliações</TabsTrigger>
            {canCreateEvaluations && <TabsTrigger value="team" className="text-xs">Avaliações da Equipe</TabsTrigger>}
            {canManageStructure && <TabsTrigger value="structure" className="text-xs">Estrutura</TabsTrigger>}
          </TabsList>
        </ScrollArea>

        {/* ===== PENDENCIES TAB ===== */}
        <TabsContent value="pendencies" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Tabs value={pendencyTab} onValueChange={setPendencyTab}>
                <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${canCreateEvaluations ? 4 : 2}, minmax(0, 1fr))` }}>
                  {canCreateEvaluations && (
                    <TabsTrigger value="to-evaluate" className="text-[10px] md:text-xs relative">
                      Avaliar
                      {toEvaluate.length > 0 && <Badge className="ml-1 h-4 min-w-4 text-[9px] bg-blue-500 hover:bg-blue-500">{toEvaluate.length}</Badge>}
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="awaiting-approval" className="text-[10px] md:text-xs relative">
                    Para Aprovar
                    {pendingApproval.length > 0 && <Badge className="ml-1 h-4 min-w-4 text-[9px] bg-amber-500 hover:bg-amber-500">{pendingApproval.length}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="contested" className="text-[10px] md:text-xs relative">
                    Contestadas
                    {contested.length > 0 && <Badge className="ml-1 h-4 min-w-4 text-[9px] bg-destructive hover:bg-destructive">{contested.length}</Badge>}
                  </TabsTrigger>
                  {canCreateEvaluations && (
                    <TabsTrigger value="finalize" className="text-[10px] md:text-xs relative">
                      Finalizar
                      {awaitingFinalization.length > 0 && <Badge className="ml-1 h-4 min-w-4 text-[9px] bg-green-500 hover:bg-green-500">{awaitingFinalization.length}</Badge>}
                    </TabsTrigger>
                  )}
                </TabsList>

                {canCreateEvaluations && (
                  <TabsContent value="to-evaluate">
                    {toEvaluate.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 opacity-50 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma avaliação pendente de preenchimento.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">{toEvaluate.map(ev => renderEvalCard(ev))}</div>
                    )}
                  </TabsContent>
                )}

                <TabsContent value="awaiting-approval">
                  {pendingApproval.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 opacity-50 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma avaliação aguardando sua aprovação.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">{pendingApproval.map(ev => renderEvalCard(ev))}</div>
                  )}
                </TabsContent>

                <TabsContent value="contested">
                  {contested.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 opacity-50 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma avaliação contestada.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">{contested.map(ev => renderEvalCard(ev))}</div>
                  )}
                </TabsContent>

                {canCreateEvaluations && (
                  <TabsContent value="finalize">
                    {awaitingFinalization.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 opacity-50 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma avaliação aguardando finalização.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">{awaitingFinalization.map(ev => renderEvalCard(ev))}</div>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Date filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dashDateFrom} onChange={e => setDashDateFrom(e.target.value)} className="h-8 text-xs w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dashDateTo} onChange={e => setDashDateTo(e.target.value)} className="h-8 text-xs w-40" />
            </div>
            {(dashDateFrom || dashDateTo) && (
              <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => { setDashDateFrom(''); setDashDateTo(''); }}>Limpar</Button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Score chart */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Notas por Colaborador</CardTitle></CardHeader>
              <CardContent>
                {dashboardScores.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação finalizada.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dashboardScores.map(e => ({ name: (e.evaluated_name || '').split(' ')[0], score: e.overall_score }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Nota" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Classification pie */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribuição por Classificação</CardTitle></CardHeader>
              <CardContent>
                {classDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={classDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                        {classDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Monthly avg by employee */}
          {monthlyAvgByEmployee.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Evolução Mensal de Notas por Colaborador</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyAvgByEmployee}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 5]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {employeeNames.slice(0, 8).map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent evaluations - last 10 with scroll */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Últimas Avaliações</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {evaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação.</p>
                ) : (
                  <div className="space-y-2 pr-3">
                    {evaluations.slice(0, 10).map(ev => (
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
                            {ev.evaluator_name}{ev.overall_score != null && ` • ${ev.overall_score}/5`} • {new Date(ev.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Nota" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team - renamed for clarity */}
        {canCreateEvaluations && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Avaliações dos Colaboradores</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Avaliações criadas por você para membros da sua equipe</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {teamEvaluations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação criada para a equipe.</p>
                ) : (
                  <div className="space-y-2">
                    {teamEvaluations.map(ev => renderEvalCard(ev))}
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
                          <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm group">
                            <button
                              onClick={() => {
                                setShowPosCompetencies(p.id);
                                fetchPositionCompetencies(p.id).then(pcs => {
                                  setPosCompItems(pcs.map(pc => ({ competency_id: pc.competency_id, weight: pc.weight })));
                                });
                              }}
                              className="flex-1 text-left"
                            >
                              <span className="text-foreground">{p.name}</span>
                              <Badge variant="outline" className="text-[10px] ml-2">{compCount} comp.</Badge>
                            </button>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                setPosName(p.name); setPosDesc(p.description || '');
                                setShowEditPosition(p.id);
                              }}><Edit2 className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={async () => {
                                if (confirm('Excluir este cargo?')) { await deletePosition(p.id); }
                              }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
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
                    <Button size="sm" variant="ghost" onClick={() => { setCompName(''); setCompDesc(''); setCompCategory('behavioral'); setShowNewCompetency(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px]">
                    {competencies.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma competência.</p> : (
                      <div className="space-y-1">{competencies.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm group">
                          <div className="flex-1">
                            <span className="text-foreground">{c.name}</span>
                            {c.description && <p className="text-[10px] text-muted-foreground">{c.description}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">{c.category === 'technical' ? 'Técnica' : 'Comp.'}</Badge>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                setCompName(c.name); setCompDesc(c.description || ''); setCompCategory(c.category);
                                setShowEditCompetency(c.id);
                              }}><Edit2 className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={async () => {
                                if (confirm('Excluir esta competência?')) { await deleteCompetency(c.id); }
                              }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
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
                    <Button size="sm" variant="ghost" onClick={() => { setCycleName(''); setCycleStart(''); setCycleEnd(''); setCycleDesc(''); setShowNewCycle(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px]">
                    {cycles.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum ciclo.</p> : (
                      <div className="space-y-1">{cycles.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 text-sm group">
                          <div className="flex-1">
                            <span className="text-foreground">{c.name}</span>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(c.start_date).toLocaleDateString('pt-BR')} — {new Date(c.end_date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{c.status === 'active' ? 'Ativo' : 'Encerrado'}</Badge>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                setCycleName(c.name); setCycleStart(c.start_date); setCycleEnd(c.end_date); setCycleDesc(c.description || '');
                                setShowEditCycle(c.id);
                              }}><Edit2 className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={async () => {
                                if (confirm('Excluir este ciclo?')) { await deleteCycle(c.id); }
                              }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
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
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={posDesc} onChange={e => setPosDesc(e.target.value)} placeholder="Opcional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPosition(false)}>Cancelar</Button>
            <Button onClick={async () => { if (!posName.trim()) return; await createPosition({ name: posName, description: posDesc || undefined }); setShowNewPosition(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Position */}
      <Dialog open={!!showEditPosition} onOpenChange={() => setShowEditPosition(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Cargo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={posName} onChange={e => setPosName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={posDesc} onChange={e => setPosDesc(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPosition(null)}>Cancelar</Button>
            <Button onClick={async () => { if (!showEditPosition || !posName.trim()) return; await updatePosition(showEditPosition, { name: posName, description: posDesc || undefined }); setShowEditPosition(null); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Competency */}
      <Dialog open={showNewCompetency} onOpenChange={setShowNewCompetency}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Competência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={compName} onChange={e => setCompName(e.target.value)} placeholder="Ex: Comunicação" /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={compDesc} onChange={e => setCompDesc(e.target.value)} placeholder="Opcional" /></div>
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
            <Button onClick={async () => { if (!compName.trim()) return; await createCompetency({ name: compName, description: compDesc || undefined, category: compCategory }); setShowNewCompetency(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Competency */}
      <Dialog open={!!showEditCompetency} onOpenChange={() => setShowEditCompetency(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Competência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={compName} onChange={e => setCompName(e.target.value)} /></div>
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
            <Button variant="outline" onClick={() => setShowEditCompetency(null)}>Cancelar</Button>
            <Button onClick={async () => { if (!showEditCompetency || !compName.trim()) return; await updateCompetency(showEditCompetency, { name: compName, description: compDesc || undefined, category: compCategory }); setShowEditCompetency(null); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Cycle */}
      <Dialog open={showNewCycle} onOpenChange={setShowNewCycle}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Ciclo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={cycleName} onChange={e => setCycleName(e.target.value)} placeholder="Ex: 1º Semestre 2026" /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={cycleDesc} onChange={e => setCycleDesc(e.target.value)} placeholder="Opcional" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={cycleEnd} onChange={e => setCycleEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCycle(false)}>Cancelar</Button>
            <Button onClick={async () => { if (!cycleName.trim() || !cycleStart || !cycleEnd) return; await createCycle({ name: cycleName, start_date: cycleStart, end_date: cycleEnd, description: cycleDesc || undefined }); setShowNewCycle(false); }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cycle */}
      <Dialog open={!!showEditCycle} onOpenChange={() => setShowEditCycle(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Ciclo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={cycleName} onChange={e => setCycleName(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={cycleDesc} onChange={e => setCycleDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="date" value={cycleEnd} onChange={e => setCycleEnd(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCycle(null)}>Cancelar</Button>
            <Button onClick={async () => { if (!showEditCycle || !cycleName.trim()) return; await updateCycle(showEditCycle, { name: cycleName, start_date: cycleStart, end_date: cycleEnd, description: cycleDesc || undefined }); setShowEditCycle(null); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Evaluation */}
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
                    <SelectItem key={m.id} value={m.id}>{m.display_name || m.name} {m.registration_number && `(${m.registration_number})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo</Label>
              <Select value={evalPosition} onValueChange={setEvalPosition}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ciclo (opcional)</Label>
              <Select value={evalCycle} onValueChange={setEvalCycle}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {cycles.filter(c => c.status === 'active').map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
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
                      const next = [...posCompItems]; next[idx].competency_id = v; setPosCompItems(next);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Competência" /></SelectTrigger>
                      <SelectContent>
                        {competencies.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input type="number" min={1} max={10} value={item.weight} onChange={e => {
                      const next = [...posCompItems]; next[idx].weight = Number(e.target.value); setPosCompItems(next);
                    }} className="h-8 text-xs" placeholder="Peso" />
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setPosCompItems(posCompItems.filter((_, i) => i !== idx))}>✕</Button>
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
              await savePositionCompetencies(showPosCompetencies, posCompItems.filter(i => i.competency_id));
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
                  {/* Editing mode */}
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
                                  const next = [...editingItems]; next[idx].score = v; setEditingItems(next);
                                })}
                                {item.score && (
                                  <Badge className={cn("text-[10px]", classifyColor(classifyScore(item.score)))}>{classifyLabel(classifyScore(item.score))}</Badge>
                                )}
                              </div>
                              <Textarea
                                value={item.evaluator_comment}
                                onChange={e => { const next = [...editingItems]; next[idx].evaluator_comment = e.target.value; setEditingItems(next); }}
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
                        <Textarea value={overallComment} onChange={e => setOverallComment(e.target.value)} placeholder="Comentário geral..." rows={3} />
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

                  {/* Action buttons */}
                  <Separator />
                  <div className="flex gap-2 flex-wrap">
                    {isEvaluated && currentEval.status === 'sent' && (
                      <>
                        <Button size="sm" className="gap-1" onClick={async () => { await approveEvaluation(currentEval.id); setShowEvalDetail(null); }}>
                          <ThumbsUp className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={async () => { await approveEvaluation(currentEval.id, 'Aprovada com observação'); setShowEvalDetail(null); }}>
                          Aprovar com Observação
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                          setItemContestations({}); setContestComment(''); setShowContestDialog(currentEval.id);
                        }}>
                          <ThumbsDown className="h-3.5 w-3.5" /> Contestar
                        </Button>
                      </>
                    )}

                    {isEvaluator && currentEval.status === 'contested' && (
                      <Button size="sm" variant="outline" className="gap-1 text-amber-600" onClick={() => {
                        setItemReplies({}); setRespondComment(''); setShowRespondDialog(currentEval.id);
                      }}>
                        <MessageSquare className="h-3.5 w-3.5" /> Responder Contestação
                      </Button>
                    )}

                    {isEvaluator && ['approved', 'approved_with_obs'].includes(currentEval.status) && (
                      <Button size="sm" className="gap-1" onClick={async () => { await finalizeEvaluation(currentEval.id); setShowEvalDetail(null); }}>
                        <ClipboardCheck className="h-3.5 w-3.5" /> Finalizar
                      </Button>
                    )}

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
              <p className="text-xs text-muted-foreground">Conteste competências específicas ou deixe uma observação geral.</p>
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
              <p className="text-xs text-muted-foreground">Revise as contestações e responda. Você pode ajustar notas.</p>
              {evalItems.filter(i => i.evaluated_response).map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{item.competency_name}</p>
                    {renderStars(item.score)}
                  </div>
                  <p className="text-xs text-destructive bg-destructive/5 rounded p-2">⚠️ Contestação: {item.evaluated_response}</p>
                  <Textarea
                    value={itemReplies[item.id]?.reply || ''}
                    onChange={e => setItemReplies(prev => ({ ...prev, [item.id]: { ...prev[item.id], reply: e.target.value } }))}
                    placeholder="Sua resposta..."
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px]">Ajustar nota?</Label>
                    <Select
                      value={String(itemReplies[item.id]?.new_score || item.score || '')}
                      onValueChange={v => setItemReplies(prev => ({ ...prev, [item.id]: { ...prev[item.id] || { reply: '' }, new_score: Number(v) } }))}
                    >
                      <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
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
