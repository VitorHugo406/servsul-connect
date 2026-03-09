import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Plus, X, GripVertical, BarChart2, MessageSquare, CheckCircle2,
  Clock, AlertTriangle, Star, Table2, TrendingUp, LayoutDashboard,
  Calendar, ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';
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
  | 'tasks_pie';

type WidgetSize = 'sm' | 'md' | 'lg';

interface Widget {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  dateRange: string; // e.g. "30d" | "90d" | "6m" | "12m"
}

interface WidgetDef {
  type: WidgetType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: WidgetSize;
}

const WIDGET_DEFS: WidgetDef[] = [
  { type: 'tasks_by_status', label: 'Tarefas por Status', description: 'Gráfico de barras com tarefas por status', icon: <BarChart2 className="h-5 w-5" />, defaultSize: 'md' },
  { type: 'tasks_timeline', label: 'Evolução de Tarefas', description: 'Linha do tempo de tarefas concluídas', icon: <TrendingUp className="h-5 w-5" />, defaultSize: 'lg' },
  { type: 'tasks_pie', label: 'Distribuição de Tarefas', description: 'Pizza com distribuição de tarefas', icon: <BarChart2 className="h-5 w-5" />, defaultSize: 'md' },
  { type: 'messages_sent', label: 'Mensagens Enviadas', description: 'Total de mensagens enviadas no chat', icon: <MessageSquare className="h-5 w-5" />, defaultSize: 'sm' },
  { type: 'pending_tasks', label: 'Tarefas Pendentes', description: 'Quantidade de tarefas em aberto', icon: <Clock className="h-5 w-5" />, defaultSize: 'sm' },
  { type: 'completed_tasks', label: 'Tarefas Concluídas', description: 'Tarefas finalizadas no período', icon: <CheckCircle2 className="h-5 w-5" />, defaultSize: 'sm' },
  { type: 'late_tasks', label: 'Entregas com Atraso', description: 'Tarefas entregues fora do prazo', icon: <AlertTriangle className="h-5 w-5" />, defaultSize: 'sm' },
  { type: 'monthly_score', label: 'Score do Mês', description: 'Minha pontuação mensal em tarefas', icon: <Star className="h-5 w-5" />, defaultSize: 'sm' },
  { type: 'score_comparison', label: 'Comparativo de Score', description: 'Score mês a mês comparado', icon: <BarChart2 className="h-5 w-5" />, defaultSize: 'lg' },
];

const DATE_RANGES = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '12m', label: 'Últimos 12 meses' },
];

const SIZE_LABELS: Record<WidgetSize, string> = { sm: 'Pequeno', md: 'Médio', lg: 'Grande' };

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#f59e0b', '#ef4444', '#10b981'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRangeFilter(range: string): { from: Date; to: Date } {
  const now = new Date();
  if (range === '7d') return { from: subDays(now, 7), to: now };
  if (range === '30d') return { from: subDays(now, 30), to: now };
  if (range === '90d') return { from: subDays(now, 90), to: now };
  if (range === '6m') return { from: subMonths(now, 6), to: now };
  return { from: subMonths(now, 12), to: now };
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const STORAGE_KEY = 'meu_painel_widgets';

function loadWidgets(): Widget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Defaults
  return [
    { id: generateId(), type: 'pending_tasks', size: 'sm', dateRange: '30d' },
    { id: generateId(), type: 'completed_tasks', size: 'sm', dateRange: '30d' },
    { id: generateId(), type: 'late_tasks', size: 'sm', dateRange: '30d' },
    { id: generateId(), type: 'monthly_score', size: 'sm', dateRange: '30d' },
    { id: generateId(), type: 'tasks_by_status', size: 'md', dateRange: '30d' },
    { id: generateId(), type: 'tasks_timeline', size: 'lg', dateRange: '30d' },
  ];
}

function saveWidgets(widgets: Widget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
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
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      try {
        if (widget.type === 'pending_tasks') {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', profileId)
            .neq('status', 'done')
            .eq('is_archived', false);
          if (!cancelled) setData({ value: count ?? 0 });
        }

        else if (widget.type === 'completed_tasks') {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', profileId)
            .eq('status', 'done')
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso);
          if (!cancelled) setData({ value: count ?? 0 });
        }

        else if (widget.type === 'late_tasks') {
          const { count } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', profileId)
            .eq('completed_late', true)
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso);
          if (!cancelled) setData({ value: count ?? 0 });
        }

        else if (widget.type === 'messages_sent') {
          const [{ count: sectorCount }, { count: dmCount }] = await Promise.all([
            supabase.from('messages').select('*', { count: 'exact', head: true })
              .eq('author_id', profileId)
              .gte('created_at', fromIso).lte('created_at', toIso),
            supabase.from('direct_messages').select('*', { count: 'exact', head: true })
              .eq('sender_id', profileId)
              .gte('created_at', fromIso).lte('created_at', toIso),
          ]);
          if (!cancelled) setData({ value: (sectorCount ?? 0) + (dmCount ?? 0) });
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
          if (!cancelled) setData({ value: s?.score ?? 0, completed: s?.completed_tasks ?? 0, late: s?.late_tasks ?? 0, onTime: s?.on_time_tasks ?? 0 });
        }

        else if (widget.type === 'tasks_by_status') {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('status')
            .eq('assigned_to', profileId)
            .gte('created_at', fromIso)
            .lte('created_at', toIso);
          const map: Record<string, number> = {};
          for (const t of tasks || []) {
            map[t.status] = (map[t.status] || 0) + 1;
          }
          const statusLabels: Record<string, string> = {
            todo: 'A fazer', in_progress: 'Em progresso', done: 'Concluído',
            review: 'Em revisão', blocked: 'Bloqueado',
          };
          if (!cancelled) setData(Object.entries(map).map(([k, v]) => ({ name: statusLabels[k] || k, value: v })));
        }

        else if (widget.type === 'tasks_pie') {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('status')
            .eq('assigned_to', profileId)
            .gte('created_at', fromIso)
            .lte('created_at', toIso);
          const map: Record<string, number> = {};
          for (const t of tasks || []) {
            map[t.status] = (map[t.status] || 0) + 1;
          }
          const statusLabels: Record<string, string> = {
            todo: 'A fazer', in_progress: 'Em progresso', done: 'Concluído',
            review: 'Em revisão', blocked: 'Bloqueado',
          };
          if (!cancelled) setData(Object.entries(map).map(([k, v]) => ({ name: statusLabels[k] || k, value: v })));
        }

        else if (widget.type === 'tasks_timeline') {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('completed_at, created_at')
            .eq('assigned_to', profileId)
            .eq('status', 'done')
            .gte('completed_at', fromIso)
            .lte('completed_at', toIso)
            .order('completed_at', { ascending: true });

          // Group by week/month
          const grouped: Record<string, number> = {};
          for (const t of tasks || []) {
            if (!t.completed_at) continue;
            const d = new Date(t.completed_at);
            const key = format(d, 'dd/MM', { locale: ptBR });
            grouped[key] = (grouped[key] || 0) + 1;
          }
          if (!cancelled) setData(Object.entries(grouped).map(([k, v]) => ({ date: k, concluídas: v })));
        }

        else if (widget.type === 'score_comparison') {
          const months = [];
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
          if (!cancelled) setData(months.map(m => ({
            mês: format(new Date(m + '-01'), 'MMM/yy', { locale: ptBR }),
            score: map[m] ?? 0,
          })));
        }
      } catch (e) {
        console.error('Widget data error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [profileId, widget.type, widget.dateRange]);

  return { data, loading };
}

// ─── Stat Widget ─────────────────────────────────────────────────────────────

function StatWidget({ widget, onRemove, onChangeSize, onChangeDateRange }: {
  widget: Widget; onRemove: () => void; onChangeSize: (s: WidgetSize) => void; onChangeDateRange: (r: string) => void;
}) {
  const { profile } = useAuth();
  const { data, loading } = useWidgetData(widget, profile?.id);
  const def = WIDGET_DEFS.find(d => d.type === widget.type)!;

  const colorMap: Partial<Record<WidgetType, string>> = {
    pending_tasks: 'text-warning',
    completed_tasks: 'text-success',
    late_tasks: 'text-destructive',
    monthly_score: 'text-primary',
    messages_sent: 'text-blue-500',
  };

  const bgMap: Partial<Record<WidgetType, string>> = {
    pending_tasks: 'bg-warning/10',
    completed_tasks: 'bg-success/10',
    late_tasks: 'bg-destructive/10',
    monthly_score: 'bg-primary/10',
    messages_sent: 'bg-blue-500/10',
  };

  return (
    <Card className="relative group h-full">
      <WidgetControls widget={widget} onRemove={onRemove} onChangeSize={onChangeSize} onChangeDateRange={onChangeDateRange} />
      <CardContent className="flex flex-col items-center justify-center p-6 h-full gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', bgMap[widget.type] || 'bg-muted')}>
          <span className={cn('', colorMap[widget.type] || 'text-foreground')}>{def.icon}</span>
        </div>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className={cn('text-4xl font-bold tabular-nums', colorMap[widget.type] || 'text-foreground')}>
            {data?.value ?? 0}
          </p>
        )}
        <p className="text-sm text-muted-foreground text-center font-medium">{def.label}</p>
        <p className="text-[10px] text-muted-foreground/60">{DATE_RANGES.find(d => d.value === widget.dateRange)?.label}</p>
      </CardContent>
    </Card>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

function WidgetControls({ widget, onRemove, onChangeSize, onChangeDateRange }: {
  widget: Widget; onRemove: () => void; onChangeSize: (s: WidgetSize) => void; onChangeDateRange: (r: string) => void;
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-md border border-border/50 shadow-sm">
      <Select value={widget.dateRange} onValueChange={onChangeDateRange}>
        <SelectTrigger className="h-7 w-[110px] text-[10px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGES.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="w-px h-4 bg-border/50 mx-1"></div>
      <Select value={widget.size} onValueChange={(v) => onChangeSize(v as WidgetSize)}>
        <SelectTrigger className="h-7 w-[90px] text-[10px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SIZE_LABELS) as WidgetSize[]).map(s => (
            <SelectItem key={s} value={s} className="text-xs">{SIZE_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="w-px h-4 bg-border/50 mx-1"></div>
      <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="w-px h-4 bg-border/50 mx-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center px-1 drag-handle" title="Arraste para mover">
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// ─── Chart Widget ─────────────────────────────────────────────────────────────

function ChartWidget({ widget, onRemove, onChangeSize, onChangeDateRange }: {
  widget: Widget; onRemove: () => void; onChangeSize: (s: WidgetSize) => void; onChangeDateRange: (r: string) => void;
}) {
  const { profile } = useAuth();
  const { data, loading } = useWidgetData(widget, profile?.id);
  const def = WIDGET_DEFS.find(d => d.type === widget.type)!;

  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  return (
    <Card className="relative group h-full">
      <WidgetControls widget={widget} onRemove={onRemove} onChangeSize={onChangeSize} onChangeDateRange={onChangeDateRange} />
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-primary">{def.icon}</span>
          {def.label}
          <span className="ml-auto text-[10px] font-normal text-muted-foreground">
            {DATE_RANGES.find(d => d.value === widget.dateRange)?.label}
          </span>
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
        ) : widget.type === 'tasks_by_status' ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : widget.type === 'tasks_pie' ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(data as any[]).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : widget.type === 'tasks_timeline' ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="concluídas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : widget.type === 'score_comparison' ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mês" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Widget Router ────────────────────────────────────────────────────────────

function WidgetRenderer({ widget, onRemove, onChangeSize, onChangeDateRange }: {
  widget: Widget; onRemove: () => void; onChangeSize: (s: WidgetSize) => void; onChangeDateRange: (r: string) => void;
}) {
  const statTypes: WidgetType[] = ['pending_tasks', 'completed_tasks', 'late_tasks', 'monthly_score', 'messages_sent'];
  if (statTypes.includes(widget.type)) {
    return <StatWidget widget={widget} onRemove={onRemove} onChangeSize={onChangeSize} onChangeDateRange={onChangeDateRange} />;
  }
  return <ChartWidget widget={widget} onRemove={onRemove} onChangeSize={onChangeSize} onChangeDateRange={onChangeDateRange} />;
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function MyDashboardSection() {
  const { profile } = useAuth();
  const [widgets, setWidgets] = useState<Widget[]>(() => loadWidgets());
  const [showPicker, setShowPicker] = useState(false);

  const persist = (w: Widget[]) => { setWidgets(w); saveWidgets(w); };

  const addWidget = (type: WidgetType) => {
    const def = WIDGET_DEFS.find(d => d.type === type)!;
    const newW: Widget = { id: generateId(), type, size: def.defaultSize, dateRange: '30d' };
    persist([...widgets, newW]);
    setShowPicker(false);
  };

  const removeWidget = (id: string) => persist(widgets.filter(w => w.id !== id));

  const changeSize = (id: string, size: WidgetSize) =>
    persist(widgets.map(w => w.id === id ? { ...w, size } : w));

  const changeDateRange = (id: string, dateRange: string) =>
    persist(widgets.map(w => w.id === id ? { ...w, dateRange } : w));

  // Grid col span per size
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
            <p className="text-xs text-muted-foreground">
              Olá, {profile?.display_name || profile?.name}! Veja seu desempenho personalizado.
            </p>
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-2">Painel vazio</h3>
            <p className="text-muted-foreground mb-6 max-w-xs">
              Adicione widgets para visualizar suas métricas, gráficos e estatísticas personalizadas.
            </p>
            <Button onClick={() => setShowPicker(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar primeiro widget
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-3 gap-4 auto-rows-auto">
            <AnimatePresence>
              {widgets.map((widget) => (
                <motion.div
                  key={widget.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className={cn(colSpan[widget.size], rowHeight[widget.size])}
                >
                  <WidgetRenderer
                    widget={widget}
                    onRemove={() => removeWidget(widget.id)}
                    onChangeSize={(s) => changeSize(widget.id, s)}
                    onChangeDateRange={(r) => changeDateRange(widget.id, r)}
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
                    <Badge variant="outline" className="mt-2 text-[10px]">{SIZE_LABELS[def.defaultSize]}</Badge>
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
