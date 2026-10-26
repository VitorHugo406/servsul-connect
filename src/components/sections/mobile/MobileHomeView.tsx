import { useEffect, useState } from 'react';
import { MessageSquare, Bell, Cake, ChevronRight, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Building2, TrendingUp, ListTodo } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useBirthdays } from '@/hooks/useData';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useTodayMessages } from '@/hooks/useTodayMessages';
import { supabase } from '@/integrations/supabase/client';

interface Props { onNavigate: (section: string) => void; }

export function MobileHomeView({ onNavigate }: Props) {
  const { profile, sector } = useAuth();
  const { company } = useCompany();
  const { todayMessages } = useTodayMessages();
  const { announcements } = useAnnouncements();
  const { birthdayPeople } = useBirthdays();
  const [totalTasks, setTotalTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) { setTasksLoading(false); return; }
    let cancelled = false;
    (async () => {
      setTasksLoading(true);
      const [overdueResult, totalResult] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).is('completed_at', null).lt('due_date', new Date().toISOString()),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assigned_to', profile.id).is('completed_at', null),
      ]);
      if (cancelled) return;
      setOverdueTasks(overdueResult.count || 0);
      setTotalTasks(totalResult.count || 0);
      setTasksLoading(false);
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const firstName = displayName.trim().split(/\s+/)[0] || 'Usuário';
  const todayBdays = birthdayPeople.filter((person) => person.isToday).length;
  const tasksValue = tasksLoading ? '—' : String(totalTasks);

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

      <section className="ewvon-uber-actions">
        <div className="ewvon-uber-section-title"><h2>Acessos rápidos</h2><span>Seu dia a dia</span></div>
        <div className="ewvon-uber-action-list">
          {actions.map(({ id, title, subtitle, icon: Icon, count }) => (
            <button type="button" key={id} onClick={() => onNavigate(id)} className="ewvon-uber-action">
              <span className="ewvon-uber-action-icon"><Icon size={20} strokeWidth={1.8} /></span>
              <span className="ewvon-uber-action-copy"><strong>{title}</strong><small>{subtitle}</small></span>
              {count > 0 && <span className="ewvon-uber-count">{count}</span>}
              <ChevronRight size={18} className="ewvon-uber-chevron" />
            </button>
          ))}
        </div>
      </section>

      {overdueTasks > 0 && <button type="button" className="ewvon-uber-alert" onClick={() => onNavigate('home')}>
        <AlertTriangle size={18} /><span><strong>Você tem {overdueTasks} {overdueTasks === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</strong><small>Reserve um momento para revisar suas pendências.</small></span><ChevronRight size={18} />
      </button>}

      <p className="ewvon-uber-footer">ewvon · Gestão de operações</p>
    </div>
  );
}
