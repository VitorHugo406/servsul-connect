import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { useVisibleMenuItems } from '@/components/layout/menuItems';
import { sectionLock } from '@/lib/planAccess';
import { cn } from '@/lib/utils';

/**
 * Passo a passo do PC (mesmo formato do tour do app): vai de aba em aba, destaca o que importa e só mostra
 * as áreas que o perfil realmente acessa. Nunca envia nada nem cria dados: só navega e destaca.
 */
interface Step {
  section: string | null;
  sel?: string[];          // seletores tentados em ordem; sem achar, destaca a área principal
  title: string;
  text: string;
  logo?: boolean;
  next?: string;
  pad?: number;
}
interface Props { onNavigate: (section: string) => void; onEnd: () => void }

const MAIN = '.ewvon-main';

export function DesktopTour({ onNavigate, onEnd }: Props) {
  const { profile, isAdmin, canAccess, roles } = useAuth();
  const { plan } = useCompanyPlan();
  const menu = useVisibleMenuItems();
  const isSuper = roles.some((r: any) => (r.role as string) === 'super_admin');
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const [shown, setShown] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const runId = useRef(0);

  const has = useCallback((id: string) => {
    if (sectionLock(id, plan, isSuper)) return false;
    if (menu.some(m => m.id === id)) return true;
    if (id === 'tasks' || id === 'my-dashboard' || id === 'notes') return true;
    if (id === 'people-management') return isAdmin || ['supervisor', 'gerente', 'gestor', 'diretoria'].includes(profile?.autonomy_level || '');
    return false;
  }, [menu, plan, isSuper, isAdmin, profile?.autonomy_level]);

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [];
    const name = (profile?.display_name || profile?.name || '').split(' ')[0];
    s.push({ section: 'home', title: `Bem-vindo ao ewvon${name ? ', ' + name : ''}!`, text: 'Vou te levar por cada área que o seu perfil pode usar, uma aba por vez. É só acompanhar e tocar em Próximo.', next: 'Começar tour', logo: true });
    s.push({ section: 'home', sel: ['.ewvon-sidebar'], title: 'Menu lateral', text: 'Aqui ficam todas as áreas liberadas para você. Os ícones redondos do topo levam a Meu Painel, Anotações, Tarefas e Gestão de Pessoas.', pad: 6 });
    s.push({ section: 'home', sel: [MAIN], title: 'Início', text: 'Seu resumo do dia: mensagens, tarefas, avisos e atalhos para o que você mais usa.' });
    if (has('chat')) {
      s.push({ section: 'chat', sel: ['.chat-conversation-sidebar'], title: 'Chat: suas conversas', text: 'Setores, mensagens diretas e grupos ficam nesta lista. O número vermelho mostra o que você ainda não leu; clique com o botão direito para marcar como não lida.' });
      s.push({ section: 'chat', sel: ['.chat-thread-header', '.chat-workspace'], title: 'Dentro da conversa', text: 'No topo você vê quem está na conversa, pesquisa mensagens e abre as configurações (membros, fonte, cor e silenciar).' });
      s.push({ section: 'chat', sel: ['.chat-composer', '.chat-composer-box'], title: 'Envie mensagens', text: 'Digite e envie. ✓✓ = entregue, azul = lida. Use *negrito*, _itálico_ e ~riscado~, anexe arquivos, emojis e figurinhas, e grave áudio. Para chamar a IA use @ewvonai.' });
    }
    if (has('announcements')) s.push({ section: 'announcements', sel: [MAIN], title: 'Avisos', text: canAccess('can_post_announcements') || isAdmin ? 'Comunicados oficiais da empresa. Você pode criar, fixar, agendar e acompanhar quem já leu.' : 'Comunicados oficiais da empresa. O ponto vermelho some quando você lê; avisos fixados pedem confirmação "Ciente".' });
    if (has('birthdays')) s.push({ section: 'birthdays', sel: [MAIN], title: 'Aniversariantes', text: 'Veja quem faz aniversário e celebre com a equipe.' });
    if (has('tasks')) {
      s.push({ section: 'tasks', sel: ['.board-selection', MAIN], title: 'Tarefas: seus quadros', text: 'Cada quadro é um mural de atividades. Escolha um para abrir ou crie um novo para sua equipe.' });
      s.push({ section: 'tasks', sel: [MAIN], title: 'Cards, colunas e subtarefas', text: 'Dentro do quadro, arraste os cards entre colunas, abra um card para ver subtarefas, responsáveis, prazo, etiquetas e comentários. Concluir uma subtarefa avança o progresso do card.' });
    }
    if (has('my-dashboard')) s.push({ section: 'my-dashboard', sel: [MAIN], title: 'Meu Painel', text: 'Suas métricas pessoais: mensagens enviadas, tarefas concluídas e atrasadas.' });
    if (has('notes')) s.push({ section: 'notes', sel: [MAIN], title: 'Anotações', text: 'Notas rápidas só suas. Também dá para deixá-las numa janela flutuante.' });
    if (has('people-management')) s.push({ section: 'people-management', sel: [MAIN], title: 'Gestão de Pessoas', text: 'Acompanhe sua equipe, relatórios e feedbacks.' });
    if (has('calendar')) s.push({ section: 'calendar', sel: [MAIN], title: 'Calendário', text: 'Compromissos e reuniões. Use Mês, Semana ou Dia no topo para mudar a visão.' });
    if (has('evaluations')) s.push({ section: 'evaluations', sel: [MAIN], title: 'Avaliações', text: 'Avaliações de experiência e desenvolvimento, com o histórico da sua equipe e as suas.' });
    if (has('war-room')) s.push({ section: 'war-room', sel: [MAIN], title: 'War Room', text: 'Salas para resolver incidentes críticos: linha do tempo de ações, chat e card de emergência.' });
    if (has('meeting-rooms')) s.push({ section: 'meeting-rooms', sel: [MAIN], title: 'Sala de Reunião', text: 'Veja a disponibilidade e reserve salas em intervalos de 30 minutos.' });
    if (has('management')) s.push({ section: 'management', sel: [MAIN], title: 'Gerenciamento', text: 'Cadastro e permissões dos colaboradores.' });
    if (has('sectors')) s.push({ section: 'sectors', sel: [MAIN], title: 'Gestão de Setores', text: 'Organize os departamentos da empresa.' });
    if (has('integrations')) s.push({ section: 'integrations', sel: [MAIN], title: 'Integrações', text: 'Conecte sistemas de RH, WhatsApp, Slack, Google e a IA da empresa.' });
    if (has('billing')) s.push({ section: 'billing', sel: [MAIN], title: 'Pagamentos', text: 'Plano, faturas e recibos da empresa.' });
    s.push({ section: 'home', title: 'Tudo pronto!', text: 'Você já conhece as áreas do seu perfil. Para rever este passo a passo, use o botão de ajuda (?) no topo da página.', next: 'Começar a usar', logo: true });
    return s;
  }, [has, profile?.display_name, profile?.name, canAccess, isAdmin]);

  const step = steps[Math.min(i, steps.length - 1)];

  const measure = useCallback(() => {
    const st = steps[Math.min(i, steps.length - 1)];
    let el: Element | null = null;
    for (const q of st.sel || []) { el = document.querySelector(q); if (el) break; }
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) { setRect(null); return; }
    const p = st.pad ?? 4;
    setRect({ l: Math.max(4, r.left - p), t: Math.max(4, r.top - p), w: Math.min(window.innerWidth - 8, r.width + p * 2), h: Math.min(window.innerHeight - 8, r.height + p * 2) });
  }, [i, steps]);

  // navega e espera a aba aparecer antes de destacar
  useEffect(() => {
    const id = ++runId.current;
    setShown(false);
    if (step.section) onNavigate(step.section);
    let tries = 0;
    const t = window.setInterval(() => {
      if (runId.current !== id) { window.clearInterval(t); return; }
      measure();
      if (++tries >= 8) { window.clearInterval(t); setShown(true); }
    }, 180);
    const done = window.setTimeout(() => { if (runId.current === id) setShown(true); }, 700);
    return () => { window.clearInterval(t); window.clearTimeout(done); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [measure]);

  // posiciona o cartão ao lado do destaque
  useLayoutEffect(() => {
    const c = cardRef.current; if (!c) return;
    const W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
    let left = (W - cw) / 2, top = (H - ch) / 2;
    if (rect && !step.logo) {
      const roomRight = W - (rect.l + rect.w), roomLeft = rect.l;
      if (rect.w > W * 0.6) { top = rect.t + rect.h > H * 0.55 ? rect.t + 16 : Math.min(H - ch - 16, rect.t + rect.h + 16); left = W - cw - 32; if (top + ch > H - 12) top = H - ch - 16; }
      else if (roomRight > cw + 24) { left = rect.l + rect.w + 16; top = Math.min(Math.max(12, rect.t), H - ch - 12); }
      else if (roomLeft > cw + 24) { left = rect.l - cw - 16; top = Math.min(Math.max(12, rect.t), H - ch - 12); }
      else { top = Math.min(rect.t + rect.h + 16, H - ch - 12); }
    }
    setCardPos({ left: Math.max(12, Math.min(left, W - cw - 12)), top: Math.max(12, Math.min(top, H - ch - 12)) });
  }, [rect, i, shown, step.logo]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI(v => (v < steps.length - 1 ? v + 1 : (onEnd(), v)));
      else if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [steps.length, onEnd]);

  const last = i >= steps.length - 1;
  const showSpot = !!rect && !step.logo;

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-label="Passo a passo do sistema" style={{ pointerEvents: 'auto' }}>
      {/* destaque que desliza de um item para o outro; sem destaque, escurece a tela toda */}
      <div aria-hidden className="absolute rounded-2xl transition-all duration-500 ease-out"
        style={showSpot
          ? { left: rect!.l, top: rect!.t, width: rect!.w, height: rect!.h, boxShadow: '0 0 0 9999px rgba(15,18,24,.58), 0 0 0 3px hsl(var(--primary))' }
          : { left: '50%', top: '50%', width: 0, height: 0, boxShadow: '0 0 0 9999px rgba(15,18,24,.62)' }} />
      <div ref={cardRef} className={cn('absolute w-[360px] max-w-[92vw] rounded-3xl bg-white p-5 shadow-2xl transition-opacity duration-300', shown ? 'opacity-100' : 'opacity-0')}
        style={{ left: cardPos.left, top: cardPos.top }}>
        {step.logo && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">e</div>}
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Passo {i + 1} de {steps.length}</p>
        <h3 className={cn('mt-1 text-lg font-semibold text-slate-900', step.logo && 'text-center')}>{step.title}</h3>
        <p className={cn('mt-1.5 text-sm leading-relaxed text-slate-600', step.logo && 'text-center')}>{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onEnd} className={cn('text-xs font-medium text-slate-400 hover:text-slate-700', last && 'invisible')}>Pular tour</button>
          <div className="flex gap-2">
            {i > 0 && <button type="button" onClick={() => setI(v => Math.max(0, v - 1))} className="h-9 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>}
            <button type="button" onClick={() => (last ? onEnd() : setI(v => v + 1))} className="h-9 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">{step.next || (last ? 'Concluir' : 'Próximo')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
