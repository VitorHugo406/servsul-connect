import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, Cake,
  CheckCircle2, CircleDashed, Clock3, MessageSquare, Plus, Sparkles,
  TrendingUp, ListTodo, CalendarDays, ChevronRight,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { format, subDays, startOfDay, isSameDay, isToday, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useBirthdays } from '@/hooks/useData';
import { useTodayMessages } from '@/hooks/useTodayMessages';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/integrations/supabase/client';

interface HomeSectionProps {
  onNavigate: (section: string) => void;
}

type TaskRow = {
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  is_archived: boolean | null;
};

type MessageRow = { created_at: string | null };

const chartTooltipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(228,228,231,.9)',
  background: 'rgba(255,255,255,.96)',
  boxShadow: '0 12px 35px rgba(0,0,0,.07)',
  fontSize: 12,
};

const statusLabels: Record<string, string> = {
  todo: 'A fazer',
  pending: 'Pendente',
  in_progress: 'Em andamento',
  doing: 'Em andamento',
  done: 'Concluída',
  completed: 'Concluída',
  review: 'Em revisão',
  blocked: 'Bloqueada',
};

const statusColors = ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8', '#71717a', '#e4e4e7'];

export function HomeSection({ onNavigate }: HomeSectionProps) {
  const { profile, sector } = useAuth();
  const { todayMessages } = useTodayMessages();
  const { announcements } = useAnnouncements();
  const { birthdayPeople } = useBirthdays();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageRow[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setLoadingMetrics(false);
      return;
    }

    let cancelled = false;
    const loadMetrics = async () => {
      setLoadingMetrics(true);
      const since = startOfDay(subDays(new Date(), 6)).toISOString();
      const [taskResult, sectorMessages, directMessages] = await Promise.all([
        supabase
          .from('tasks')
          .select('status, created_at, completed_at, due_date, is_archived')
          .eq('assigned_to', profile.id)
          .eq('is_archived', false),
        supabase
          .from('messages')
          .select('created_at')
          .eq('author_id', profile.id)
          .gte('created_at', since),
        supabase
          .from('direct_messages')
          .select('created_at')
          .eq('sender_id', profile.id)
          .gte('created_at', since),
      ]);

      if (cancelled) return;
      setTasks((taskResult.data || []) as TaskRow[]);
      setMessageHistory([
        ...((sectorMessages.data || []) as MessageRow[]),
        ...((directMessages.data || []) as MessageRow[]),
      ]);
      setLoadingMetrics(false);
    };

    void loadMetrics();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const initials = displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const openTasks = tasks.filter((task) => !task.completed_at && !['done', 'completed'].includes((task.status || '').toLowerCase()));
  const overdueTasks = openTasks.filter((task) => task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)));
  const completedLast7 = tasks.filter((task) => task.completed_at && new Date(task.completed_at) >= startOfDay(subDays(new Date(), 6))).length;
  const todayBirthdays = birthdayPeople.filter((person) => person.isToday);
  const visibleBirthdays = birthdayPeople.slice(0, 4);
  const latestAnnouncement = announcements[0];

  const taskStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      const status = (task.status || 'pending').toLowerCase();
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([status, value], index) => ({
      name: statusLabels[status] || status.replace(/_/g, ' '),
      value,
      fill: statusColors[index % statusColors.length],
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [tasks]);

  const activityData = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = startOfDay(subDays(new Date(), 6 - index));
    return {
      day: format(day, 'EEE', { locale: ptBR }).replace('.', ''),
      fullDate: format(day, 'dd/MM', { locale: ptBR }),
      mensagens: messageHistory.filter((message) => message.created_at && isSameDay(new Date(message.created_at), day)).length,
      tarefas: tasks.filter((task) => task.completed_at && isSameDay(new Date(task.completed_at), day)).length,
    };
  }), [messageHistory, tasks]);

  const totalMessages7 = messageHistory.length;
  const completionRate = tasks.length ? Math.round((tasks.filter((task) => task.completed_at || ['done', 'completed'].includes((task.status || '').toLowerCase())).length / tasks.length) * 100) : 0;

  const metrics = [
    { label: 'Mensagens hoje', value: todayMessages, icon: MessageSquare, note: 'Enviadas por você', section: 'chat' },
    { label: 'Tarefas em aberto', value: openTasks.length, icon: ListTodo, note: overdueTasks.length ? `${overdueTasks.length} em atraso` : 'Nenhuma urgência identificada', section: 'tasks', alert: overdueTasks.length > 0 },
    { label: 'Concluídas em 7 dias', value: completedLast7, icon: CheckCircle2, note: 'Últimos sete dias', section: 'tasks' },
    { label: 'Avisos publicados', value: announcements.length, icon: Bell, note: 'Disponíveis para você', section: 'announcements' },
  ];

  return (
    <div className="ewvon-home mx-auto w-full max-w-[1680px] space-y-5 p-4 sm:p-6 lg:p-7">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="ewvon-glass-panel relative overflow-hidden rounded-[28px] border border-white/80 p-5 shadow-[0_12px_45px_rgba(24,24,27,0.045)] sm:p-7"
      >
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-zinc-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-48 w-48 rounded-full bg-zinc-100 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-14 w-14 border border-white shadow-sm ring-4 ring-zinc-100 sm:h-[68px] sm:w-[68px]">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-zinc-900 text-lg font-semibold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-[.16em] text-zinc-500">Seu espaço de trabalho</span>
                <span className="h-1 w-1 rounded-full bg-zinc-300" />
                <span className="text-xs text-zinc-500">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">Olá, {displayName.split(' ')[0]}</h1>
              <p className="mt-1 text-sm text-zinc-500">Aqui está o resumo atualizado da sua rotina.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sector?.name && <Badge className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-zinc-700 shadow-none hover:bg-white">{sector.name}</Badge>}
                <Badge variant="outline" className="rounded-full border-zinc-200 bg-white/60 px-3 py-1 text-zinc-500">Visão pessoal</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onNavigate('tasks')} className="h-10 rounded-full bg-zinc-950 px-4 text-white shadow-sm hover:bg-zinc-800">
              <Plus className="mr-2 h-4 w-4" /> Abrir tarefas
            </Button>
            <Button variant="outline" onClick={() => onNavigate('my-dashboard')} className="h-10 rounded-full border-zinc-200 bg-white/70 px-4 text-zinc-700 hover:bg-white">
              <Activity className="mr-2 h-4 w-4" /> Meu painel
            </Button>
          </div>
        </div>
      </motion.section>

      <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <motion.button
              key={metric.label}
              type="button"
              onClick={() => onNavigate(metric.section)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.045, duration: 0.25 }}
              className="ewvon-glass-card group min-w-0 rounded-[24px] border border-white/90 p-5 text-left shadow-[0_6px_24px_rgba(24,24,27,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-[0_12px_32px_rgba(24,24,27,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 text-zinc-700 shadow-sm"><Icon className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                <span className="rounded-full border border-zinc-200/80 bg-white/65 p-2 text-zinc-400 transition group-hover:text-zinc-800"><ArrowUpRight className="h-3.5 w-3.5" /></span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2">
                <div>
                  <p className="text-sm text-zinc-500">{metric.label}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">{loadingMetrics && metric.label !== 'Mensagens hoje' && metric.label !== 'Avisos publicados' ? <span className="inline-block h-8 w-10 animate-pulse rounded-lg bg-zinc-200" /> : metric.value}</p>
                </div>
                {metric.alert && <span className="mb-1 rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">Atenção</span>}
              </div>
              <p className="mt-2 text-xs text-zinc-400">{metric.note}</p>
            </motion.button>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="ewvon-glass-panel rounded-[26px] border border-white/90 p-5 shadow-[0_8px_30px_rgba(24,24,27,0.035)] sm:p-6 xl:col-span-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><TrendingUp className="h-4 w-4" /></span><h2 className="font-semibold tracking-tight text-zinc-900">Sua atividade</h2></div>
              <p className="mt-1 pl-10 text-sm text-zinc-500">Mensagens enviadas e tarefas concluídas · 7 dias</p>
            </div>
            <Badge variant="outline" className="rounded-full border-zinc-200 bg-white/70 text-zinc-500">Últimos 7 dias</Badge>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="ewvonMessagesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#52525b" stopOpacity={0.18} /><stop offset="100%" stopColor="#52525b" stopOpacity={0.01} /></linearGradient>
                  <linearGradient id="ewvonTasksFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.2} /><stop offset="100%" stopColor="#a1a1aa" stopOpacity={0.02} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="3 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''} />
                <Area type="monotone" dataKey="mensagens" name="Mensagens" stroke="#52525b" strokeWidth={2.5} fill="url(#ewvonMessagesFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="tarefas" name="Tarefas concluídas" stroke="#a1a1aa" strokeWidth={2.5} fill="url(#ewvonTasksFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-5 border-t border-zinc-100 pt-4">
            <div><p className="text-xs text-zinc-400">Mensagens no período</p><p className="mt-1 text-lg font-semibold text-zinc-900">{loadingMetrics ? '—' : totalMessages7}</p></div>
            <div><p className="text-xs text-zinc-400">Tarefas concluídas</p><p className="mt-1 text-lg font-semibold text-zinc-900">{loadingMetrics ? '—' : completedLast7}</p></div>
            <div><p className="text-xs text-zinc-400">Conclusão das tarefas</p><p className="mt-1 text-lg font-semibold text-zinc-900">{loadingMetrics ? '—' : `${completionRate}%`}</p></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="ewvon-glass-panel rounded-[26px] border border-white/90 p-5 shadow-[0_8px_30px_rgba(24,24,27,0.035)] sm:p-6 xl:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><CircleDashed className="h-4 w-4" /></span><h2 className="font-semibold tracking-tight text-zinc-900">Tarefas por status</h2></div><p className="mt-1 pl-10 text-sm text-zinc-500">Distribuição atual</p></div>
            <button type="button" onClick={() => onNavigate('tasks')} aria-label="Abrir tarefas" className="rounded-full border border-zinc-200 bg-white/70 p-2 text-zinc-500 hover:bg-white hover:text-zinc-900"><ChevronRight className="h-4 w-4" /></button>
          </div>
          {taskStatusData.length ? (
            <>
              <div className="relative mx-auto mt-2 h-[178px] w-full max-w-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} paddingAngle={3} stroke="none" cornerRadius={5}>
                      {taskStatusData.map((entry, index) => <Cell key={entry.name} fill={entry.fill || statusColors[index % statusColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tracking-tight text-zinc-900">{loadingMetrics ? '—' : tasks.length}</span><span className="text-[11px] text-zinc-400">tarefas</span></div>
              </div>
              <div className="mt-1 space-y-2">
                {taskStatusData.slice(0, 4).map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 text-zinc-500"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} /><span className="truncate">{item.name}</span></span><span className="font-medium tabular-nums text-zinc-800">{item.value}</span></div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[250px] flex-col items-center justify-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400"><ListTodo className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-zinc-700">{loadingMetrics ? 'Carregando indicadores' : 'Sem tarefas para exibir'}</p><p className="mt-1 max-w-[210px] text-xs leading-5 text-zinc-400">Quando houver tarefas atribuídas a você, a distribuição aparecerá aqui.</p></div>
          )}
        </motion.div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="ewvon-glass-panel rounded-[26px] border border-white/90 p-5 shadow-[0_8px_30px_rgba(24,24,27,0.035)] sm:p-6 xl:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><Bell className="h-4 w-4" /></span><h2 className="font-semibold tracking-tight text-zinc-900">Último aviso</h2></div><p className="mt-1 pl-10 text-sm text-zinc-500">Comunicados recentes da sua empresa</p></div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('announcements')} className="h-9 rounded-full border-zinc-200 bg-white/70 px-3 text-xs text-zinc-600 hover:bg-white">Ver todos <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
          </div>
          {latestAnnouncement ? (
            <button type="button" onClick={() => onNavigate('announcements')} className="group w-full rounded-2xl border border-zinc-200/80 bg-white/65 p-4 text-left transition hover:border-zinc-300 hover:bg-white">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600"><Bell className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-medium text-zinc-900">{latestAnnouncement.title}</p><p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">{latestAnnouncement.content}</p><p className="mt-3 text-xs text-zinc-400">{latestAnnouncement.author?.display_name || latestAnnouncement.author?.name || 'Equipe'} · Comunicado</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:text-zinc-800" /></div>
            </button>
          ) : <div className="flex min-h-[118px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/40 px-4 text-center"><Bell className="h-5 w-5 text-zinc-300" /><p className="mt-2 text-sm text-zinc-500">Nenhum aviso publicado no momento.</p></div>}
        </div>

        <div className="ewvon-glass-panel rounded-[26px] border border-white/90 p-5 shadow-[0_8px_30px_rgba(24,24,27,0.035)] sm:p-6 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"><Cake className="h-4 w-4" /></span><h2 className="font-semibold tracking-tight text-zinc-900">Aniversariantes</h2></div><p className="mt-1 pl-10 text-sm text-zinc-500">Pessoas para celebrar este mês</p></div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('birthdays')} className="h-9 rounded-full border-zinc-200 bg-white/70 px-3 text-xs text-zinc-600 hover:bg-white">Ver todos <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>
          </div>
          {visibleBirthdays.length ? <div className="space-y-1">
            {visibleBirthdays.map((person) => (
              <div key={person.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-white/70">
                <Avatar className="h-10 w-10 border border-zinc-200/80"><AvatarImage src={person.avatar || ''} /><AvatarFallback className="bg-zinc-100 text-xs font-medium text-zinc-700">{person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-800">{person.name}</p><p className="truncate text-xs text-zinc-400">{person.sector || 'Equipe'}</p></div>
                <Badge variant="outline" className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${person.isToday ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white/70 text-zinc-500'}`}>{person.isToday ? 'Hoje' : `${String(person.birthDay).padStart(2, '0')}/${String(person.birthMonth).padStart(2, '0')}`}</Badge>
              </div>
            ))}
            {birthdayPeople.length > visibleBirthdays.length && <p className="pt-2 text-center text-xs text-zinc-400">+{birthdayPeople.length - visibleBirthdays.length} pessoas neste mês</p>}
          </div> : <div className="flex min-h-[118px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white/40 px-4 text-center"><CalendarDays className="h-5 w-5 text-zinc-300" /><p className="mt-2 text-sm text-zinc-500">{todayBirthdays.length ? 'Há aniversariantes hoje.' : 'Nenhum aniversário neste mês.'}</p></div>}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Indicadores baseados nos dados disponíveis para sua conta.</span>
        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Atualizado ao abrir a página</span>
      </div>
    </div>
  );
}
