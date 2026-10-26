import { useEffect, useState } from 'react';
import { MessageSquare, Bell, Cake, ChevronRight, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Building2, TrendingUp, ListTodo, Palette, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useBirthdays } from '@/hooks/useData';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useTodayMessages } from '@/hooks/useTodayMessages';
import { supabase } from '@/integrations/supabase/client';

interface Props { onNavigate: (section: string) => void; onOpenNotifications: () => void; onOpenAppearance: () => void; onOpenProfile: () => void; unreadNotifications: number; }

export function MobileHomeView({ onNavigate, onOpenNotifications, onOpenAppearance, onOpenProfile, unreadNotifications }: Props) {
  const { profile, sector } = useAuth();
  const { company } = useCompany();
  const { todayMessages } = useTodayMessages();
  const { announcements } = useAnnouncements();
  const { birthdayPeople } = useBirthdays();
  const [totalTasks, setTotalTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [completedWeek, setCompletedWeek] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) { setTasksLoading(false); return; }
    let cancelled = false;
    (async () => {
      setTasksLoading(true);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);
      const [overdueResult, totalResult, completedResult] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).is('completed_at', null).lt('due_date', new Date().toISOString()),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).is('completed_at', null),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).not('completed_at', 'is', null).gte('completed_at', weekAgo.toISOString()),
      ]);
      if (cancelled) return;
      setOverdueTasks(overdueResult.count || 0);
      setTotalTasks(totalResult.count || 0);
      setCompletedWeek(completedResult.count || 0);
      setTasksLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const firstName = displayName.trim().split(/\s+/)[0] || 'Usuário';
  const todayBdays = birthdayPeople.filter((person) => person.isToday).length;
  const tasksValue = tasksLoading ? '—' : String(totalTasks);
  const taskTotalForChart = totalTasks + completedWeek;
  const pendingShare = taskTotalForChart ? Math.round((Math.max(0, totalTasks - overdueTasks) / taskTotalForChart) * 100) : 0;
  const overdueShare = taskTotalForChart ? Math.round((overdueTasks / taskTotalForChart) * 100) : 0;
  const completedShare = taskTotalForChart ? Math.max(0, 100 - pendingShare - overdueShare) : 0;

  const actions = [
    { id: 'chat', title: 'Conversas', subtitle: todayMessages ? `${todayMessages} mensagens hoje` : 'Fale com sua equipe', icon: MessageSquare, count: todayMessages },
    { id: 'announcements', title: 'Avisos', subtitle: announcements.length ? `${announcements.length} comunicados publicados` : 'Nenhum comunicado novo', icon: Bell, count: announcements.length },
    { id: 'birthdays', title: 'Aniversários', subtitle: todayBdays ? `${todayBdays} hoje` : `${birthdayPeople.length} neste mês`, icon: Cake, count: todayBdays },
  ];

  return (
    <div className="ewvon-uber-home">
      <section className="ewvon-uber-greeting">
        <div>
          <p className="ewvon-uber-kicker">PAINEL DA EMPRESA</p>
          <h1>Bom dia, {firstName}</h1>
          <p className="ewvon-uber-subtitle">Tudo o que importa para o seu dia.</p>
        </div>
        {company && <div className="ewvon-uber-company"><Building2 size={15} /><span>{company.name}</span></div>}
      </section>

      <button type="button" className="ewvon-uber-primary" onClick={() => onNavigate('chat')}>
        <span className="ewvon-uber-primary-copy">
          <span className="ewvon-uber-primary-label">VAMOS COMEÇAR</span>
          <strong>Precisa falar com alguém?</strong>
          <small>Abra uma conversa com sua equipe</small>
        </span>
        <span className="ewvon-uber-primary-arrow"><ArrowUpRight size={20} /></span>
      </button>

      <section className="ewvon-uber-stats" aria-label="Resumo de hoje">
        <article><span>Mensagens hoje</span><strong>{todayMessages}</strong><small><MessageSquare size={13} /> Atividade</small></article>
        <article><span>Tarefas pendentes</span><strong>{tasksValue}</strong><small><Clock3 size={13} /> Em aberto</small></article>
        <article className={overdueTasks > 0 ? 'is-alert' : ''}><span>Tarefas atrasadas</span><strong>{tasksLoading ? '—' : overdueTasks}</strong><small>{overdueTasks > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />} {overdueTasks > 0 ? 'Precisam de atenção' : 'Tudo sob controle'}</small></article>
      </section>

      {sector?.name && <div className="ewvon-uber-context"><span>Seu setor</span><strong>{sector.name}</strong></div>}

      <section className="ewvon-uber-insights" aria-label="Indicadores de atividade">
        <div className="ewvon-uber-section-title"><h2>Visão geral</h2><span>Seus indicadores</span></div>
        <div className="ewvon-uber-chart-carousel" aria-label="Gráficos do painel">\n        <div className="ewvon-uber-chart-card">
          <div className="ewvon-uber-chart-heading"><span className="ewvon-uber-chart-icon"><ListTodo size={18}/></span><span><strong>Suas tarefas</strong><small>Distribuição das pendências</small></span><span className="ewvon-uber-chart-total">{tasksLoading ? '—' : totalTasks + completedWeek}</span></div>
          <div className="ewvon-uber-task-bars" role="img" aria-label="Resumo de tarefas pendentes, atrasadas e concluídas nos últimos sete dias">
            <div className="ewvon-uber-task-bar"><span className="ewvon-uber-task-bar-label"><i className="pending"/>Pendentes<strong>{tasksLoading ? '—' : totalTasks}</strong></span><span className="ewvon-uber-track"><i className="pending" style={{width: tasksLoading ? '0%' : String(pendingShare) + '%'}}/></span></div>
            <div className="ewvon-uber-task-bar"><span className="ewvon-uber-task-bar-label"><i className="overdue"/>Atrasadas<strong>{tasksLoading ? '—' : overdueTasks}</strong></span><span className="ewvon-uber-track"><i className="overdue" style={{width: tasksLoading ? '0%' : String(overdueShare) + '%'}}/></span></div>
            <div className="ewvon-uber-task-bar"><span className="ewvon-uber-task-bar-label"><i className="completed"/>Concluídas · 7 dias<strong>{tasksLoading ? '—' : completedWeek}</strong></span><span className="ewvon-uber-track"><i className="completed" style={{width: tasksLoading ? '0%' : String(completedShare) + '%'}}/></span></div>
          </div>
          <p className="ewvon-uber-chart-note"><TrendingUp size={14}/> Acompanhe o andamento sem sair do início.</p>
        </div>
        <div className="ewvon-uber-section-title ewvon-uber-activity-title"><h2>Atividade da equipe</h2><span>Hoje</span></div>
        <div className="ewvon-uber-activity-grid">
          <button type="button" onClick={() => onNavigate('chat')} className="ewvon-uber-activity-card"><span className="ewvon-uber-activity-top"><MessageSquare size={17}/><ArrowUpRight size={15}/></span><strong>{todayMessages}</strong><span>Mensagens</span><small>Conversas de hoje</small></button>
          <button type="button" onClick={() => onNavigate('announcements')} className="ewvon-uber-activity-card"><span className="ewvon-uber-activity-top"><Bell size={17}/><ArrowUpRight size={15}/></span><strong>{announcements.length}</strong><span>Avisos publicados</span><small>Comunicados da empresa</small></button>
          <button type="button" onClick={() => onNavigate('birthdays')} className="ewvon-uber-activity-card"><span className="ewvon-uber-activity-top"><Cake size={17}/><ArrowUpRight size={15}/></span><strong>{todayBdays || birthdayPeople.length}</strong><span>Aniversariantes</span><small>{todayBdays ? 'Fazem aniversário hoje' : 'Na lista deste mês'}</small></button>
        </div>
      </section>

      {overdueTasks > 0 && <button type="button" className="ewvon-uber-alert" onClick={() => onNavigate('home')}>
        <AlertTriangle size={18} /><span><strong>Você tem {overdueTasks} {overdueTasks === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</strong><small>Reserve um momento para revisar suas pendências.</small></span><ChevronRight size={18} />
      </button>}

      <p className="ewvon-uber-footer">ewvon · Gestão de operações</p>
    </div>
  );
}
