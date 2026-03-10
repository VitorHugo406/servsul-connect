import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Plus,
  X,
  GripVertical,
  BarChart2,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  TrendingUp,
  LayoutDashboard,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { addDays, eachDayOfInterval, format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────────────────────

type WidgetType =
  | 'tasks_by_status'
  | 'tasks_timeline'
  | 'messages_sent'
  | 'pending_tasks'
  | 'late_tasks'
  | 'monthly_score'
  | 'score_comparison'
  | 'completed_tasks'
  | 'tasks_pie'
  | 'tasks_by_priority'
  | 'completion_rate'
  | 'avg_completion_time';

type WidgetSize = 'sm' | 'md' | 'lg';

type ChartVariant = 'bar' | 'line' | 'pie' | 'area' | 'donut';

interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  dateRange: string; // e.g. "7d" | "30d" | "90d" | "6m" | "12m"
  chartVariant?: ChartVariant; // only for chart widgets
  comparePrev?: boolean; // compare with previous period
}

interface WidgetDef {
  type: WidgetType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: WidgetSize;
}

const WIDGET_DEFS: WidgetDef[] = [
  {
    type: 'tasks_by_status',
    label: 'Tarefas por Status',
    description: 'Distribuição por coluna/status no período',
    icon: <BarChart2 className="h-5 w-5" />,
    defaultSize: 'md',
  },
  {
    type: 'tasks_timeline',
    label: 'Evolução de Tarefas',
    description: 'Linha do tempo de tarefas concluídas',
    icon: <TrendingUp className="h-5 w-5" />,
    defaultSize: 'lg',
  },
  {
    type: 'tasks_pie',
    label: 'Distribuição de Tarefas',
    description: 'Distribuição (pizza/barra) por coluna/status',
    icon: <BarChart2 className="h-5 w-5" />,
    defaultSize: 'md',
  },
  {
    type: 'messages_sent',
    label: 'Mensagens Enviadas',
    description: 'Total de mensagens enviadas no chat',
    icon: <MessageSquare className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'pending_tasks',
    label: 'Tarefas Pendentes',
    description: 'Quantidade de tarefas em aberto',
    icon: <Clock className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'completed_tasks',
    label: 'Tarefas Concluídas',
    description: 'Tarefas finalizadas no período',
    icon: <CheckCircle2 className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'late_tasks',
    label: 'Entregas com Atraso',
    description: 'Tarefas entregues fora do prazo',
    icon: <AlertTriangle className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'monthly_score',
    label: 'Score do Mês',
    description: 'Minha pontuação mensal em tarefas',
    icon: <Star className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'score_comparison',
    label: 'Comparativo de Score',
    description: 'Score mês a mês comparado',
    icon: <BarChart2 className="h-5 w-5" />,
    defaultSize: 'lg',
  },
  {
    type: 'tasks_by_priority',
    label: 'Tarefas por Prioridade',
    description: 'Distribuição por nível de prioridade',
    icon: <AlertTriangle className="h-5 w-5" />,
    defaultSize: 'md',
  },
  {
    type: 'completion_rate',
    label: 'Taxa de Conclusão',
    description: 'Percentual de tarefas concluídas no período',
    icon: <CheckCircle2 className="h-5 w-5" />,
    defaultSize: 'sm',
  },
  {
    type: 'avg_completion_time',
    label: 'Tempo Médio de Conclusão',
    description: 'Dias médios para concluir uma tarefa',
    icon: <Clock className="h-5 w-5" />,
    defaultSize: 'sm',
  },
];

const DATE_RANGES = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '12m', label: 'Últimos 12 meses' },
];

const SIZE_LABELS: Record<WidgetSize, string> = { sm: 'Pequeno', md: 'Médio', lg: 'Grande' };

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRangeFilter(range: string): { from: Date; to: Date } {
  const now = new Date();
  if (range === '7d') return { from: subDays(now, 7), to: now };
  if (range === '30d') return { from: subDays(now, 30), to: now };
  if (range === '90d') return { from: subDays(now, 90), to: now };
  if (range === '6m') return { from: subMonths(now, 6), to: now };
  return { from: subMonths(now, 12), to: now };
}

function getPreviousRange(from: Date, to: Date) {
  const durationMs = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - durationMs),
    to: new Date(to.getTime() - durationMs),
  };
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const STORAGE_KEY = 'meu_painel_widgets';

function getAllowedChartVariants(type: WidgetType): ChartVariant[] {
  if (type === 'tasks_by_status' || type === 'tasks_pie' || type === 'tasks_by_priority') return ['bar', 'pie', 'donut'];
  if (type === 'tasks_timeline') return ['line', 'bar', 'area'];
  if (type === 'score_comparison') return ['bar', 'line', 'area'];
  return ['bar'];
}

function getDefaultChartVariant(type: WidgetType): ChartVariant | undefined {
  if (type === 'tasks_by_status') return 'bar';
  if (type === 'tasks_pie') return 'pie';
  if (type === 'tasks_by_priority') return 'donut';
  if (type === 'tasks_timeline') return 'line';
  if (type === 'score_comparison') return 'bar';
  return undefined;
}

function widgetSupportsCompare(type: WidgetType) {
  return ['pending_tasks', 'completed_tasks', 'late_tasks', 'messages_sent', 'tasks_by_status', 'tasks_timeline', 'tasks_pie', 'tasks_by_priority', 'completion_rate', 'avg_completion_time'].includes(type);
}

function normalizeWidget(w: Widget): Widget {
  const allowed = getAllowedChartVariants(w.type);
  const defaultVariant = getDefaultChartVariant(w.type);
  const currentVariant = w.chartVariant;
  const chartVariant = currentVariant && allowed.includes(currentVariant) ? currentVariant : defaultVariant;

  return {
    ...w,
    chartVariant,
    comparePrev: Boolean(w.comparePrev),
  };
}

function loadWidgets(): Widget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Widget[];
      if (Array.isArray(parsed)) return parsed.map(normalizeWidget);
    }
  } catch {
    // ignore
  }
  // Defaults
  const defaults: Widget[] = [
    { id: generateId(), type: 'pending_tasks', size: 'sm', dateRange: '30d', comparePrev: false },
    { id: generateId(), type: 'completed_tasks', size: 'sm', dateRange: '30d', comparePrev: false },
    { id: generateId(), type: 'late_tasks', size: 'sm', dateRange: '30d', comparePrev: false },
    { id: generateId(), type: 'monthly_score', size: 'sm', dateRange: '30d' },
    { id: generateId(), type: 'tasks_by_status', size: 'md', dateRange: '30d', chartVariant: 'bar', comparePrev: false },
    { id: generateId(), type: 'tasks_timeline', size: 'lg', dateRange: '30d', chartVariant: 'line', comparePrev: false },
  ];

  return defaults.map(normalizeWidget);
}

function saveWidgets(widgets: Widget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets.map(normalizeWidget)));
}

async function fetchExtraAssignedTaskIds(profileId: string) {
  const { data } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('profile_id', profileId);

  const ids = (data || []).map((r) => r.task_id).filter(Boolean);
  return Array.from(new Set(ids));
}

function buildAssignedTasksOr(profileId: string, extraTaskIds: string[]) {
  if (!extraTaskIds.length) return `assigned_to.eq.${profileId}`;
  return `assigned_to.eq.${profileId},id.in.(${extraTaskIds.join(',')})`;
}

function isCompletedTask(t: { completed_at?: string | null; status?: string | null }) {
  return Boolean(t.completed_at) || t.status === 'done';
}

// ─── Data hooks ──────────────────────────────────────────────────────────────

function useWidgetData(widget: Widget, profileId: string | undefined) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;
    setLoading(true);

    async function fetch() {
      const { from, to } = getDateRangeFilter(widget.dateRange);
      const prev = widget.comparePrev ? getPreviousRange(from, to) : null;

      const fromIso = from.toISOString();
      const toIso = to.toISOString();
      const prevFromIso = prev?.from.toISOString();
      const prevToIso = prev?.to.toISOString();

      try {
        const needsTaskData = ['pending_tasks', 'completed_tasks', 'late_tasks', 'tasks_by_status', 'tasks_timeline', 'tasks_pie'].includes(widget.type);
        const extraTaskIds = needsTaskData ? await fetchExtraAssignedTaskIds(profileId) : [];

        // ── Stat widgets ──────────────────────────────────────────────────────
        if (widget.type === 'pending_tasks') {
          const currentQ = supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .or(buildAssignedTasksOr(profileId, extraTaskIds))
            .is('completed_at', null)
            .eq('is_archived', false);

          const { count: current } = await currentQ;

          if (widget.comparePrev && prevFromIso && prevToIso) {
            // "Pendentes" no período anterior: tarefas que estavam abertas naquele período (aprox.)
            const prevQ = supabase
              .from('tasks')
              .select('id, created_at, completed_at, is_archived', { count: 'exact', head: true })
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .eq('is_archived', false)
              .lte('created_at', prevToIso)
              .or(`completed_at.is.null,completed_at.gt.${prevToIso}`);

            const { count: previous } = await prevQ;
            if (!cancelled) setData({ value: current ?? 0, previous: previous ?? 0 });
          } else {
            if (!cancelled) setData({ value: current ?? 0 });
          }
        }

        else if (widget.type === 'completed_tasks') {
          const { count: current } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .or(buildAssignedTasksOr(profileId, extraTaskIds))
            .not('completed_at', 'is', null)
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso);

          if (widget.comparePrev && prevFromIso && prevToIso) {
            const { count: previous } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .not('completed_at', 'is', null)
              .gte('completed_at', prevFromIso)
              .lte('completed_at', prevToIso);

            if (!cancelled) setData({ value: current ?? 0, previous: previous ?? 0 });
          } else {
            if (!cancelled) setData({ value: current ?? 0 });
          }
        }

        else if (widget.type === 'late_tasks') {
          const { count: current } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .or(buildAssignedTasksOr(profileId, extraTaskIds))
            .eq('completed_late', true)
            .not('completed_at', 'is', null)
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso);

          if (widget.comparePrev && prevFromIso && prevToIso) {
            const { count: previous } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .eq('completed_late', true)
              .not('completed_at', 'is', null)
              .gte('completed_at', prevFromIso)
              .lte('completed_at', prevToIso);

            if (!cancelled) setData({ value: current ?? 0, previous: previous ?? 0 });
          } else {
            if (!cancelled) setData({ value: current ?? 0 });
          }
        }

        else if (widget.type === 'messages_sent') {
          const [currSector, currDm] = await Promise.all([
            supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('author_id', profileId)
              .gte('created_at', fromIso)
              .lte('created_at', toIso),
            supabase
              .from('direct_messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', profileId)
              .gte('created_at', fromIso)
              .lte('created_at', toIso),
          ]);

          const current = (currSector.count ?? 0) + (currDm.count ?? 0);

          if (widget.comparePrev && prevFromIso && prevToIso) {
            const [prevSector, prevDm] = await Promise.all([
              supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', profileId)
                .gte('created_at', prevFromIso)
                .lte('created_at', prevToIso),
              supabase
                .from('direct_messages')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', profileId)
                .gte('created_at', prevFromIso)
                .lte('created_at', prevToIso),
            ]);

            const previous = (prevSector.count ?? 0) + (prevDm.count ?? 0);
            if (!cancelled) setData({ value: current, previous });
          } else {
            if (!cancelled) setData({ value: current });
          }
        }

        else if (widget.type === 'monthly_score') {
          const yearMonth = format(new Date(), 'yyyy-MM');
          const { data: scores } = await supabase
            .from('monthly_scores')
            .select('score, completed_tasks, late_tasks, on_time_tasks')
            .eq('profile_id', profileId)
            .eq('year_month', yearMonth)
            .limit(1);

          const s = scores?.[0];
          if (!cancelled) {
            setData({
              value: s?.score ?? 0,
              completed: s?.completed_tasks ?? 0,
              late: s?.late_tasks ?? 0,
              onTime: s?.on_time_tasks ?? 0,
            });
          }
        }

        // ── Chart widgets ─────────────────────────────────────────────────────
        else if (widget.type === 'tasks_by_status' || widget.type === 'tasks_pie') {
          const fetchTasksForRange = async (rangeFromIso: string, rangeToIso: string) => {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('status, board_id, completed_at')
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .gte('created_at', rangeFromIso)
              .lte('created_at', rangeToIso);

            return tasks || [];
          };

          const [currTasks, prevTasks] = await Promise.all([
            fetchTasksForRange(fromIso, toIso),
            widget.comparePrev && prevFromIso && prevToIso ? fetchTasksForRange(prevFromIso, prevToIso) : Promise.resolve([] as any[]),
          ]);

          const allColumnIds = Array.from(
            new Set(
              [...currTasks, ...prevTasks]
                .map((t) => t.status)
                .filter((s) => typeof s === 'string' && UUID_RE.test(s)) as string[],
            ),
          );

          const { data: columns } = allColumnIds.length
            ? await supabase.from('task_board_columns').select('id, title').in('id', allColumnIds)
            : { data: [] as any[] };

          const colTitleById = new Map<string, string>((columns || []).map((c) => [c.id, c.title]));

          const statusLabels: Record<string, string> = {
            todo: 'A fazer',
            in_progress: 'Em progresso',
            done: 'Concluído',
            review: 'Em revisão',
            blocked: 'Bloqueado',
          };

          const labelForStatus = (status: string) => colTitleById.get(status) || statusLabels[status] || status;

          const countByLabel = (tasks: any[]) => {
            const map: Record<string, number> = {};
            for (const t of tasks) {
              const raw = String(t.status || '');
              const label = labelForStatus(raw);
              map[label] = (map[label] || 0) + 1;
            }
            return map;
          };

          const currMap = countByLabel(currTasks);

          if (widget.comparePrev) {
            const prevMap = countByLabel(prevTasks);
            const keys = Array.from(new Set([...Object.keys(currMap), ...Object.keys(prevMap)])).sort();
            if (!cancelled) setData(keys.map((name) => ({ name, atual: currMap[name] ?? 0, anterior: prevMap[name] ?? 0 })));
          } else {
            const keys = Object.keys(currMap).sort();
            if (!cancelled) setData(keys.map((name) => ({ name, value: currMap[name] ?? 0 })));
          }
        }

        else if (widget.type === 'tasks_timeline') {
          const fetchCompletedForRange = async (rangeFromIso: string, rangeToIso: string) => {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('completed_at, status')
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .gte('completed_at', rangeFromIso)
              .lte('completed_at', rangeToIso)
              .order('completed_at', { ascending: true });

            return (tasks || []).filter((t) => isCompletedTask(t));
          };

          const [currTasks, prevTasks] = await Promise.all([
            fetchCompletedForRange(fromIso, toIso),
            widget.comparePrev && prevFromIso && prevToIso ? fetchCompletedForRange(prevFromIso, prevToIso) : Promise.resolve([] as any[]),
          ]);

          // Build aligned day buckets (same X labels, previous shifted onto current labels)
          const days = eachDayOfInterval({ start: from, end: to });

          const toKey = (d: Date) => format(d, 'dd/MM', { locale: ptBR });

          const makeDailyMap = (tasks: any[]) => {
            const map: Record<string, number> = {};
            for (const t of tasks) {
              if (!t.completed_at) continue;
              const d = new Date(t.completed_at);
              const k = toKey(d);
              map[k] = (map[k] || 0) + 1;
            }
            return map;
          };

          const currMap = makeDailyMap(currTasks);

          if (widget.comparePrev && prev) {
            const prevMapRaw = makeDailyMap(prevTasks);

            const rows = days.map((day, idx) => {
              const label = toKey(day);
              const prevDay = addDays(prev.from, idx);
              const prevLabel = toKey(prevDay);
              return {
                date: label,
                atual: currMap[label] ?? 0,
                anterior: prevMapRaw[prevLabel] ?? 0,
              };
            });

            if (!cancelled) setData(rows);
          } else {
            const grouped: Record<string, number> = {};
            for (const day of days) grouped[toKey(day)] = currMap[toKey(day)] ?? 0;
            if (!cancelled) setData(Object.entries(grouped).map(([date, concluídas]) => ({ date, concluídas })));
          }
        }

        else if (widget.type === 'score_comparison') {
          const months: string[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            months.push(format(d, 'yyyy-MM'));
          }

          const { data: scores } = await supabase
            .from('monthly_scores')
            .select('score, year_month')
            .eq('profile_id', profileId)
            .in('year_month', months);

          const map: Record<string, number> = {};
          for (const s of scores || []) map[s.year_month] = s.score;

          if (!cancelled)
            setData(
              months.map((m) => ({
                mês: format(new Date(`${m}-01`), 'MMM/yy', { locale: ptBR }),
                score: map[m] ?? 0,
              })),
            );
        }

        else if (widget.type === 'tasks_by_priority') {
          const priorityLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
          const fetchByPriority = async (rangeFrom: string, rangeTo: string) => {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('priority')
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .gte('created_at', rangeFrom)
              .lte('created_at', rangeTo);
            const map: Record<string, number> = {};
            for (const t of tasks || []) {
              const label = priorityLabels[t.priority] || t.priority;
              map[label] = (map[label] || 0) + 1;
            }
            return map;
          };

          const [currMap, prevMap] = await Promise.all([
            fetchByPriority(fromIso, toIso),
            widget.comparePrev && prevFromIso && prevToIso ? fetchByPriority(prevFromIso, prevToIso) : Promise.resolve({} as Record<string, number>),
          ]);

          if (widget.comparePrev) {
            const keys = Array.from(new Set([...Object.keys(currMap), ...Object.keys(prevMap)])).sort();
            if (!cancelled) setData(keys.map((name) => ({ name, atual: currMap[name] ?? 0, anterior: prevMap[name] ?? 0 })));
          } else {
            const keys = Object.keys(currMap).sort();
            if (!cancelled) setData(keys.map((name) => ({ name, value: currMap[name] ?? 0 })));
          }
        }

        else if (widget.type === 'completion_rate') {
          const { data: allTasks } = await supabase
            .from('tasks')
            .select('completed_at')
            .or(buildAssignedTasksOr(profileId, extraTaskIds))
            .gte('created_at', fromIso)
            .lte('created_at', toIso);

          const total = allTasks?.length || 0;
          const completed = allTasks?.filter(t => t.completed_at).length || 0;
          const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

          if (widget.comparePrev && prevFromIso && prevToIso) {
            const { data: prevTasks } = await supabase
              .from('tasks')
              .select('completed_at')
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .gte('created_at', prevFromIso)
              .lte('created_at', prevToIso);

            const prevTotal = prevTasks?.length || 0;
            const prevCompleted = prevTasks?.filter(t => t.completed_at).length || 0;
            const prevRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
            if (!cancelled) setData({ value: rate, previous: prevRate, suffix: '%' });
          } else {
            if (!cancelled) setData({ value: rate, suffix: '%' });
          }
        }

        else if (widget.type === 'avg_completion_time') {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('created_at, completed_at')
            .or(buildAssignedTasksOr(profileId, extraTaskIds))
            .not('completed_at', 'is', null)
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso);

          const diffs = (tasks || []).map(t => {
            const created = new Date(t.created_at).getTime();
            const completed = new Date(t.completed_at!).getTime();
            return (completed - created) / (1000 * 60 * 60 * 24); // days
          });
          const avg = diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10 : 0;

          if (widget.comparePrev && prevFromIso && prevToIso) {
            const { data: prevTasks } = await supabase
              .from('tasks')
              .select('created_at, completed_at')
              .or(buildAssignedTasksOr(profileId, extraTaskIds))
              .not('completed_at', 'is', null)
              .gte('completed_at', prevFromIso)
              .lte('completed_at', prevToIso);

            const prevDiffs = (prevTasks || []).map(t => {
              const created = new Date(t.created_at).getTime();
              const completed = new Date(t.completed_at!).getTime();
              return (completed - created) / (1000 * 60 * 60 * 24);
            });
            const prevAvg = prevDiffs.length ? Math.round((prevDiffs.reduce((a, b) => a + b, 0) / prevDiffs.length) * 10) / 10 : 0;
            if (!cancelled) setData({ value: avg, previous: prevAvg, suffix: 'd' });
          } else {
            if (!cancelled) setData({ value: avg, suffix: 'd' });
          }
        }
      } catch (e) {
        console.error('Widget data error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [profileId, widget.type, widget.dateRange, widget.chartVariant, widget.comparePrev]);

  return { data, loading };
}

function formatDelta(current: number, previous: number) {
  if (!previous) return current ? '+∞%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

// ─── Stat Widget ─────────────────────────────────────────────────────────────

function StatWidget({
  widget,
  onRemove,
  onChangeSize,
  onChangeDateRange,
  onToggleCompare,
}: {
  widget: Widget;
  onRemove: () => void;
  onChangeSize: (s: WidgetSize) => void;
  onChangeDateRange: (r: string) => void;
  onToggleCompare: () => void;
}) {
  const { profile } = useAuth();
  const { data, loading } = useWidgetData(widget, profile?.id);
  const def = WIDGET_DEFS.find((d) => d.type === widget.type)!;

  const colorMap: Partial<Record<WidgetType, string>> = {
    pending_tasks: 'text-warning',
    completed_tasks: 'text-success',
    late_tasks: 'text-destructive',
    monthly_score: 'text-primary',
    messages_sent: 'text-secondary',
    completion_rate: 'text-success',
    avg_completion_time: 'text-primary',
  };

  const bgMap: Partial<Record<WidgetType, string>> = {
    pending_tasks: 'bg-warning/10',
    completed_tasks: 'bg-success/10',
    late_tasks: 'bg-destructive/10',
    monthly_score: 'bg-primary/10',
    messages_sent: 'bg-secondary/10',
    completion_rate: 'bg-success/10',
    avg_completion_time: 'bg-primary/10',
  };

  const currentValue = data?.value ?? 0;
  const previousValue = data?.previous ?? 0;

  return (
    <Card className="relative group h-full">
      <WidgetControls
        widget={widget}
        onRemove={onRemove}
        onChangeSize={onChangeSize}
        onChangeDateRange={onChangeDateRange}
        onToggleCompare={onToggleCompare}
      />
      <CardContent className="flex flex-col items-center justify-center p-6 h-full gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', bgMap[widget.type] || 'bg-muted')}>
          <span className={cn('', colorMap[widget.type] || 'text-foreground')}>{def.icon}</span>
        </div>

        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className={cn('text-4xl font-bold tabular-nums', colorMap[widget.type] || 'text-foreground')}>
              {currentValue}{data?.suffix || ''}
            </p>
            {widget.comparePrev && widgetSupportsCompare(widget.type) ? (
              <p className="text-[10px] text-muted-foreground">
                Anterior: {previousValue}{data?.suffix || ''} ({formatDelta(currentValue, previousValue)})
              </p>
            ) : null}
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center font-medium">{def.label}</p>
        <p className="text-[10px] text-muted-foreground/60">{DATE_RANGES.find((d) => d.value === widget.dateRange)?.label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

function WidgetControls({
  widget,
  onRemove,
  onChangeSize,
  onChangeDateRange,
  onChangeChartVariant,
  onToggleCompare,
}: {
  widget: Widget;
  onRemove: () => void;
  onChangeSize: (s: WidgetSize) => void;
  onChangeDateRange: (r: string) => void;
  onChangeChartVariant?: (v: ChartVariant) => void;
  onToggleCompare: () => void;
}) {
  const allowedVariants = getAllowedChartVariants(widget.type);

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border/50 shadow-sm">
      <Select value={widget.dateRange} onValueChange={onChangeDateRange}>
        <SelectTrigger className="h-7 w-[110px] text-[10px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map((d) => (
            <SelectItem key={d.value} value={d.value} className="text-xs">
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {allowedVariants.length > 1 && onChangeChartVariant ? (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Select value={widget.chartVariant || getDefaultChartVariant(widget.type) || 'bar'} onValueChange={(v) => onChangeChartVariant(v as ChartVariant)}>
            <SelectTrigger className="h-7 w-[78px] text-[10px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedVariants.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v === 'bar' ? 'Barra' : v === 'line' ? 'Linha' : 'Pizza'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      {widgetSupportsCompare(widget.type) ? (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <button
            onClick={onToggleCompare}
            title="Comparar com período anterior"
            className={cn(
              'flex h-7 items-center gap-1 rounded-sm px-2 text-[10px] transition-colors',
              widget.comparePrev ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Comp.
          </button>
        </>
      ) : null}

      <div className="w-px h-4 bg-border/50 mx-1" />
      <Select value={widget.size} onValueChange={(v) => onChangeSize(v as WidgetSize)}>
        <SelectTrigger className="h-7 w-[90px] text-[10px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SIZE_LABELS) as WidgetSize[]).map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {SIZE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-4 bg-border/50 mx-1" />
      <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
      <div
        className="w-px h-4 bg-border/50 mx-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center px-1 drag-handle"
        title="Arraste para mover"
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// ─── Chart Widget ─────────────────────────────────────────────────────────────

function ChartWidget({
  widget,
  onRemove,
  onChangeSize,
  onChangeDateRange,
  onChangeChartVariant,
  onToggleCompare,
}: {
  widget: Widget;
  onRemove: () => void;
  onChangeSize: (s: WidgetSize) => void;
  onChangeDateRange: (r: string) => void;
  onChangeChartVariant: (v: ChartVariant) => void;
  onToggleCompare: () => void;
}) {
  const { profile } = useAuth();
  const { data, loading } = useWidgetData(widget, profile?.id);
  const def = WIDGET_DEFS.find((d) => d.type === widget.type)!;

  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  const effectiveVariant: ChartVariant = useMemo(() => {
    const allowed = getAllowedChartVariants(widget.type);
    const v = widget.chartVariant || getDefaultChartVariant(widget.type) || allowed[0] || 'bar';
    // comparação não fica legível em pizza/donut
    if (widget.comparePrev && (v === 'pie' || v === 'donut')) return 'bar';
    return v;
  }, [widget.type, widget.chartVariant, widget.comparePrev]);

  return (
    <Card className="relative group h-full">
      <WidgetControls
        widget={widget}
        onRemove={onRemove}
        onChangeSize={onChangeSize}
        onChangeDateRange={onChangeDateRange}
        onChangeChartVariant={onChangeChartVariant}
        onToggleCompare={onToggleCompare}
      />

      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-primary">{def.icon}</span>
          {def.label}
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">{DATE_RANGES.find((d) => d.value === widget.dateRange)?.label}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <BarChart2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">Sem dados no período</p>
          </div>
        ) : widget.type === 'tasks_by_status' || widget.type === 'tasks_pie' ? (
          effectiveVariant === 'pie' ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {(data as any[]).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                {widget.comparePrev ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="anterior" name="Anterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="atual" name="Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )
        ) : widget.type === 'tasks_timeline' ? (
          effectiveVariant === 'bar' ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                {widget.comparePrev ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="anterior" name="Anterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="atual" name="Atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <Bar dataKey="concluídas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                {widget.comparePrev ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" dataKey="anterior" name="Anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="atual" name="Atual" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                  </>
                ) : (
                  <Line type="monotone" dataKey="concluídas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )
        ) : widget.type === 'score_comparison' ? (
          effectiveVariant === 'line' ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mês" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mês" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Widget Router ────────────────────────────────────────────────────────────

function WidgetRenderer({
  widget,
  onRemove,
  onChangeSize,
  onChangeDateRange,
  onChangeChartVariant,
  onToggleCompare,
}: {
  widget: Widget;
  onRemove: () => void;
  onChangeSize: (s: WidgetSize) => void;
  onChangeDateRange: (r: string) => void;
  onChangeChartVariant: (v: ChartVariant) => void;
  onToggleCompare: () => void;
}) {
  const statTypes: WidgetType[] = ['pending_tasks', 'completed_tasks', 'late_tasks', 'monthly_score', 'messages_sent'];
  if (statTypes.includes(widget.type)) {
    return (
      <StatWidget
        widget={widget}
        onRemove={onRemove}
        onChangeSize={onChangeSize}
        onChangeDateRange={onChangeDateRange}
        onToggleCompare={onToggleCompare}
      />
    );
  }

  return (
    <ChartWidget
      widget={widget}
      onRemove={onRemove}
      onChangeSize={onChangeSize}
      onChangeDateRange={onChangeDateRange}
      onChangeChartVariant={onChangeChartVariant}
      onToggleCompare={onToggleCompare}
    />
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function MyDashboardSection() {
  const { profile } = useAuth();
  const [widgets, setWidgets] = useState<Widget[]>(() => loadWidgets());
  const [showPicker, setShowPicker] = useState(false);
  const [draggedWidgetIndex, setDraggedWidgetIndex] = useState<number | null>(null);

  const persist = (w: Widget[]) => {
    const normalized = w.map(normalizeWidget);
    setWidgets(normalized);
    saveWidgets(normalized);
  };

  const addWidget = (type: WidgetType) => {
    const def = WIDGET_DEFS.find((d) => d.type === type)!;
    const newW: Widget = {
      id: generateId(),
      type,
      size: def.defaultSize,
      dateRange: '30d',
      chartVariant: getDefaultChartVariant(type),
      comparePrev: false,
    };
    persist([...widgets, newW]);
    setShowPicker(false);
  };

  const removeWidget = (id: string) => persist(widgets.filter((w) => w.id !== id));

  const changeSize = (id: string, size: WidgetSize) => persist(widgets.map((w) => (w.id === id ? { ...w, size } : w)));

  const changeDateRange = (id: string, dateRange: string) => persist(widgets.map((w) => (w.id === id ? { ...w, dateRange } : w)));

  const changeChartVariant = (id: string, chartVariant: ChartVariant) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, chartVariant } : w)));

  const toggleComparePrev = (id: string) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, comparePrev: !w.comparePrev } : w)));

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedWidgetIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';

    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedWidgetIndex === null || draggedWidgetIndex === index) return;

    const newWidgets = [...widgets];
    const draggedWidget = newWidgets[draggedWidgetIndex];

    newWidgets.splice(draggedWidgetIndex, 1);
    newWidgets.splice(index, 0, draggedWidget);

    setWidgets(newWidgets);
    setDraggedWidgetIndex(index);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
    setDraggedWidgetIndex(null);
    saveWidgets(widgets);
  };

  const colSpan: Record<WidgetSize, string> = {
    sm: 'col-span-1',
    md: 'col-span-2',
    lg: 'col-span-3',
  };

  const rowHeight: Record<WidgetSize, string> = {
    sm: 'h-52',
    md: 'h-72',
    lg: 'h-80',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Meu Painel</h2>
            <p className="text-xs text-muted-foreground">Olá, {profile?.display_name || profile?.name}! Veja seu desempenho personalizado.</p>
          </div>
        </div>
        <Button onClick={() => setShowPicker(true)} className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          Adicionar widget
        </Button>
      </div>

      {/* Grid */}
      <ScrollArea className="flex-1 p-6">
        {widgets.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Painel vazio</h3>
            <p className="text-muted-foreground mb-6 max-w-xs">Adicione widgets para visualizar suas métricas, gráficos e estatísticas personalizadas.</p>
            <Button onClick={() => setShowPicker(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar primeiro widget
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 gap-4 auto-rows-auto">
            <AnimatePresence>
              {widgets.map((widget, index) => (
                <motion.div
                  key={widget.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className={cn(colSpan[widget.size], rowHeight[widget.size], draggedWidgetIndex === index && 'opacity-50')}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, index)}
                  onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, index)}
                  onDragEnd={(e) => handleDragEnd(e as unknown as React.DragEvent)}
                >
                  <WidgetRenderer
                    widget={widget}
                    onRemove={() => removeWidget(widget.id)}
                    onChangeSize={(s) => changeSize(widget.id, s)}
                    onChangeDateRange={(r) => changeDateRange(widget.id, r)}
                    onChangeChartVariant={(v) => changeChartVariant(widget.id, v)}
                    onToggleCompare={() => toggleComparePrev(widget.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* Widget Picker Dialog */}
      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Adicionar widget ao painel
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="grid grid-cols-2 gap-3 p-1">
              {WIDGET_DEFS.map((def) => (
                <button
                  key={def.type}
                  onClick={() => addWidget(def.type)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 text-left transition-all group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {def.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground">{def.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {SIZE_LABELS[def.defaultSize]}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
