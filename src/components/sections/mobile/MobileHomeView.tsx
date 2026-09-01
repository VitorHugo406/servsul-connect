import { CompanyLogo } from '@/components/common/CompanyLogo';
import { useEffect, useState } from 'react';
import { MessageSquare, Bell, Cake, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useMessages, useBirthdays } from '@/hooks/useData';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { supabase } from '@/integrations/supabase/client';

const autonomyLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  diretoria: 'Diretoria',
  colaborador: 'Colaborador',
};

interface Props {
  onNavigate: (section: string) => void;
}

export function MobileHomeView({ onNavigate }: Props) {
  const { profile, sector } = useAuth();
  const { company } = useCompany();
  const { messages } = useMessages(sector?.id || null);
  const { announcements } = useAnnouncements();
  const { birthdayPeople } = useBirthdays();
  const [totalTasks, setTotalTasks] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count: overdue } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .is('completed_at', null)
        .lt('due_date', new Date().toISOString());
      const { count: total } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .is('completed_at', null);
      setOverdueTasks(overdue || 0);
      setTotalTasks(total || 0);
    })();
  }, [profile]);

  const displayName = profile?.display_name || profile?.name || 'Usuário';
  const level = autonomyLabels[profile?.autonomy_level || 'colaborador'];
  const todayBdays = birthdayPeople.filter((p) => p.isToday).length;

  const rows = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, sub: `${messages.length} mensagens hoje`, count: messages.length, hueShift: 0 },
    { id: 'announcements', label: 'Avisos', icon: Bell, sub: announcements.length ? `${announcements.length} publicados` : 'Tudo em dia', count: announcements.length, hueShift: 40 },
    { id: 'birthdays', label: 'Aniversariantes', icon: Cake, sub: todayBdays ? `${todayBdays} hoje` : `${birthdayPeople.length} este mês`, count: todayBdays || birthdayPeople.length, hueShift: 150 },
  ];

  return (
    <div className="px-5 pt-2 pb-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Hero */}
      <div
        className="relative mb-5 overflow-hidden rounded-[32px] border border-white/10 p-5 text-white shadow-lg"
        style={{
          background: 'linear-gradient(150deg, var(--brand-dark, hsl(var(--primary) / 0.85)), var(--brand, hsl(var(--primary))))',
          boxShadow: '0 16px 30px -14px var(--brand-glow, hsl(var(--primary) / 0.35))',
        }}
      >
        <div className="absolute -top-16 -right-14 w-44 h-44 rounded-full bg-white/[0.08]" />
        <div className="relative">
          <div className="text-[12.5px] opacity-80">Bem-vindo de volta,</div>
          <div className="text-[20px] font-bold mt-1 mb-3" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            {displayName}
          </div>
          <div className="flex gap-2 mb-5">
            {sector && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.14]">{sector.name}</span>
            )}
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/50">{level}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white/10 rounded-[24px] p-3">
              <div className="text-[11px] opacity-75">Mensagens hoje</div>
              <div className="text-xl font-semibold mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {messages.length}
              </div>
            </div>
            <div className="bg-white/10 rounded-[24px] p-3">
              <div className="text-[11px] opacity-75">Tarefas pendentes</div>
              <div className="text-xl font-semibold mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {totalTasks}
              </div>
            </div>
            {overdueTasks > 0 && (
              <div className="col-span-2 rounded-[24px] p-3 flex items-center justify-between bg-red-500/25">
                <div>
                  <div className="text-[11px] opacity-80">Atrasadas</div>
                  <div className="text-xl font-semibold mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {overdueTasks}
                  </div>
                </div>
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Company brand chip */}
      {company && (
        <div className="flex items-center justify-center gap-2 mb-4 text-[11px] text-muted-foreground">
          {company.logo_url ? (
            <CompanyLogo value={company.logo_url} alt={company.name} className="w-4 h-4 rounded object-cover" />
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--brand, hsl(var(--primary)))' }}
            />
          )}
          <span className="font-semibold">{company.name}</span>
        </div>
      )}

      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground/80 mt-1 mb-2.5 px-1">
        Acessos rápidos
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.id}
              onClick={() => onNavigate(row.id)}
              className="flex items-center gap-3 rounded-[26px] border border-border/70 bg-card p-3.5 text-left shadow-sm transition-transform active:scale-[0.99]"
              style={{ boxShadow: '0 1px 2px rgba(16,24,40,0.03)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: `hsl(calc(var(--company-hue, 220) + ${row.hueShift}) 55% 48%)` }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-foreground">{row.label}</div>
                <div className="text-[12px] text-muted-foreground truncate">{row.sub}</div>
              </div>
              {row.count > 0 && (
                <span
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white shrink-0"
                  style={{ background: 'var(--brand, hsl(var(--primary)))', fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {row.count}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
