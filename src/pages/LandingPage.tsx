import { useEffect, useState } from "react";
import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronLeft, ChevronRight, Check, ShieldCheck, MessageSquare, LayoutDashboard, Users,
  CalendarDays, ClipboardCheck, Workflow, BarChart3, Building2,
  Smartphone, PanelsTopLeft, FileText, Bell, Zap
} from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Comunicação centralizada", text: "Conversas individuais, grupos e canais por setor em um só ambiente." },
  { icon: Bell, title: "Mural e comunicados", text: "Compartilhe avisos importantes e mantenha as equipes alinhadas." },
  { icon: Workflow, title: "Kanban e tarefas", text: "Organize demandas, acompanhe responsáveis e visualize o andamento." },
  { icon: CalendarDays, title: "Calendário", text: "Visualize eventos e compromissos da equipe em uma agenda organizada." },
  { icon: ClipboardCheck, title: "Avaliações e formulários", text: "Centralize avaliações e acompanhe respostas em um fluxo organizado." },
  { icon: BarChart3, title: "Indicadores e relatórios", text: "Reúna informações operacionais para facilitar a análise e a tomada de decisão." },
  { icon: Users, title: "Gestão por setores", text: "Estruture equipes, usuários e permissões conforme a organização." },
  { icon: PanelsTopLeft, title: "Painéis personalizados", text: "Tenha uma visão prática das atividades e informações relevantes." },
  { icon: Zap, title: "Atalhos do sistema", text: "Acesse áreas e recursos da plataforma com mais agilidade." },
  { icon: Smartphone, title: "Acesso pelo celular", text: "Use a experiência responsiva e tenha o sistema à mão no dia a dia." },
  { icon: ShieldCheck, title: "Ambientes separados", text: "Empresas e departamentos têm seus próprios espaços e dados isolados." },
];

const plans = [
  { name: "Essencial", description: "Para equipes que querem organizar a rotina.", price: "R$ 89", perUser: "R$ 8,90", users: "Até 10 usuários", sectors: "Até 3 setores", storage: "2 GB", detail: "Para equipes pequenas: comunicação, avisos, tarefas, Kanban, avaliações e anotações, com até 10 usuários, 3 setores e 2 GB.", featured: false },
  { name: "Profissional", description: "Para operações que precisam de mais controle.", price: "R$ 219", perUser: "R$ 7,30", users: "Até 30 usuários", sectors: "Até 7 setores", storage: "10 GB", detail: "Mais recursos para equipes em crescimento: inclui calendário, aniversariantes, atalhos e dashboard de métricas, com até 30 usuários, 7 setores e 10 GB.", featured: true },
  { name: "Empresarial", description: "Para empresas com operações e equipes maiores.", price: "R$ 599", perUser: "R$ 5,99", users: "Até 100 usuários", sectors: "Até 15 setores", storage: "30 GB", detail: "Capacidade para operações maiores, com até 100 usuários, 15 setores, 30 GB de armazenamento, Gestão de Pessoas e War Room.", featured: false },
];

const planFeatures = [
  { category: "Comunicação e organização", items: [
    { name: "Início", essential: true, professional: true, enterprise: true },
    { name: "Chat", essential: true, professional: true, enterprise: true },
    { name: "Avisos gerais", essential: true, professional: true, enterprise: true },
    { name: "Comunicados importantes", essential: true, professional: true, enterprise: true },
    { name: "Tarefas e Kanban", essential: true, professional: true, enterprise: true },
    { name: "Avaliações", essential: true, professional: true, enterprise: true },
    { name: "Anotações", essential: true, professional: true, enterprise: true },
    { name: "Personalização de temas", essential: true, professional: true, enterprise: true },
  ]},
  { category: "Recursos adicionais", items: [
    { name: "Aniversariantes", essential: false, professional: true, enterprise: true },
    { name: "Calendário", essential: false, professional: true, enterprise: true },
    { name: "Atalhos do sistema", essential: false, professional: true, enterprise: true },
    { name: "Dashboard de métricas do sistema", essential: false, professional: true, enterprise: true },
    { name: "Gestão de Pessoas", essential: false, professional: false, enterprise: true },
    { name: "War Room", essential: false, professional: false, enterprise: true },
  ]},
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const showcaseFeatures = features;
  const currentFeature = showcaseFeatures[activeFeature];
  const screenContent = [
    { heading: "Comunicação centralizada", subheading: "Conversas e canais", metrics: [["Conversas", "12"], ["Não lidas", "03"]], section: "Conversas recentes", rows: ["Setor Administrativo", "Comercial", "Equipe Geral"], tags: ["Agora", "Há 8 min", "Há 25 min"] },
    { heading: "Mural e comunicados", subheading: "Avisos publicados", metrics: [["Publicados", "08"], ["Rascunhos", "02"]], section: "Comunicados recentes", rows: ["Atualização de procedimento", "Reunião de alinhamento", "Aviso para todos os setores"], tags: ["Hoje", "Ontem", "Esta semana"] },
    { heading: "Kanban e tarefas", subheading: "Quadro de tarefas", metrics: [["A fazer", "04"], ["Em andamento", "03"]], section: "Tarefas do quadro", rows: ["Conferir documentos", "Atualizar cadastro", "Revisar solicitação"], tags: ["Pendente", "Em andamento", "Concluída"] },
    { heading: "Calendário", subheading: "Agenda da equipe", metrics: [["Eventos no mês", "06"], ["Próximos", "02"]], section: "Próximos compromissos", rows: ["Reunião de equipe", "Prazo de entrega", "Planejamento semanal"], tags: ["20 out · 10:00", "22 out · 15:00", "26 out · 09:30"] },
    { heading: "Avaliações e formulários", subheading: "Formulários e respostas", metrics: [["Formulários", "05"], ["Respostas", "24"]], section: "Formulários recentes", rows: ["Avaliação de integração", "Pesquisa de satisfação", "Checklist operacional"], tags: ["Ativo", "Em andamento", "Rascunho"] },
    { heading: "Indicadores e relatórios", subheading: "Visão dos indicadores", metrics: [["Relatórios", "08"], ["Atualizados", "Hoje"]], section: "Relatórios disponíveis", rows: ["Resumo operacional", "Acompanhamento de demandas", "Atividades por setor"], tags: ["PDF", "Planilha", "Painel"] },
    { heading: "Gestão por setores", subheading: "Estrutura da empresa", metrics: [["Setores", "06"], ["Usuários", "42"]], section: "Setores cadastrados", rows: ["Administrativo", "Recursos Humanos", "Operações"], tags: ["12 pessoas", "8 pessoas", "15 pessoas"] },
    { heading: "Painéis personalizados", subheading: "Painel de acompanhamento", metrics: [["Widgets", "06"], ["Atalhos", "04"]], section: "Seus painéis", rows: ["Visão geral", "Demandas prioritárias", "Atividade recente"], tags: ["Padrão", "Personalizado", "Compartilhado"] },
    { heading: "Atalhos do sistema", subheading: "Acesso rápido", metrics: [["Atalhos", "04"], ["Acesso", "Rápido"]], section: "Recursos frequentes", rows: ["Conversas", "Tarefas", "Comunicados"], tags: ["Disponível", "Disponível", "Disponível"] },
    { heading: "Acesso pelo celular", subheading: "Acesso responsivo", metrics: [["Acesso", "Web"], ["Interface", "Mobile"]], section: "Acesso rápido", rows: ["Conversas", "Tarefas", "Comunicados"], tags: ["Disponível", "Disponível", "Disponível"] },
    { heading: "Ambientes separados", subheading: "Organização por empresa", metrics: [["Empresas", "02"], ["Isolamento", "Ativo"]], section: "Ambientes", rows: ["Empresa principal", "Unidade operacional", "Permissões de acesso"], tags: ["Ativo", "Ativo", "Configurável"] },
  ];
  const activeScreen = screenContent[activeFeature] ?? screenContent[0];

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 28);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] text-[#101828]">
      <div className="h-[76px] md:h-[88px]">
        <header className={`fixed left-1/2 top-3 z-50 grid w-[calc(100%-1.5rem)] max-w-7xl -translate-x-1/2 grid-cols-[1fr_auto] items-center gap-x-3 rounded-[1.35rem] border border-white/25 bg-white/15 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,.10)] backdrop-blur-2xl transition-all duration-500 ease-in-out md:top-4 md:grid-cols-[1fr_auto_1fr] md:px-7 ${scrolled ? "translate-y-0 scale-[0.98] bg-white/10 shadow-[0_12px_40px_-18px_rgba(0,0,0,.20)]" : "translate-y-0 scale-100 bg-white/15 shadow-none"}`}>
          <a href="#inicio" className="flex shrink-0 items-center gap-2.5" aria-label="Nuvexa início">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/25 bg-slate-900/10 text-current transition-all duration-500"><Zap size={20} /></span>
            <span className="flex items-center gap-2 font-bold tracking-tight">
              <span className="text-lg text-current transition-all duration-500 md:text-xl">nuvexa<span className="text-blue-500">.</span></span>
              <span className={`border-l pl-2 font-sans text-[9px] font-medium uppercase tracking-[.18em] transition-all duration-300 ${scrolled ? "hidden border-current/20 opacity-0" : "inline-block border-current/30 opacity-70"}`}>Gestão de operações</span>
            </span>
          </a>
          <nav className="hidden items-center justify-self-center gap-8 text-sm font-medium text-current md:flex">
            <a className="transition hover:opacity-65" href="#recursos">Recursos</a>
            <a className="transition hover:opacity-65" href="#como-funciona">Como funciona</a>
            <a className="transition hover:opacity-65" href="#planos">Planos</a>
          </nav>
          <div className="flex shrink-0 items-center justify-self-end gap-1 sm:gap-2">
            <Link to="/select-company" className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-current transition hover:bg-white/15 sm:inline-flex">Entrar</Link>
            <Link to="/auth" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800">Testar grátis <ArrowRight size={16} /></Link>
          </div>
        </header>
      </div>

      <section id="inicio" className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 md:grid-cols-[1.03fr_.97fr] md:px-8 md:pb-28 md:pt-20">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative z-10">
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] text-[#111d33] sm:text-5xl md:text-6xl">Menos processos espalhados. <span className="text-blue-700">Mais operação fluindo.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 md:text-lg">A Nuvexa reúne comunicação, tarefas, equipes e controles operacionais em uma plataforma pensada para simplificar a rotina da sua empresa.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/select-company" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-700/20 transition hover:-translate-y-0.5 hover:bg-blue-800">Começar avaliação gratuita <ArrowRight size={17} /></Link>
            <a href="#planos" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Ver planos pagos</a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Acesso web e mobile</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Organização por empresa</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-emerald-600" /> Recursos integrados</span>
          </div>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-3xl [perspective:1200px]">
          
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/70 bg-[#f8f9fb] shadow-[0_35px_100px_-35px_rgba(15,35,70,.45)] [transform:rotateY(-5deg)_rotateX(2deg)]">
            <div className="flex min-h-[420px] sm:min-h-[490px]">
              <aside className="flex w-12 shrink-0 flex-col items-center gap-4 bg-[#1d293f] py-3 text-slate-300 sm:w-[62px] sm:gap-[18px] sm:py-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">›</span>
                <span className="mt-1"><LayoutDashboard size={16}/></span><span><MessageSquare size={16}/></span><span><Bell size={16}/></span><span><CalendarDays size={16}/></span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white"><ClipboardCheck size={16}/></span>
                <span><CalendarDays size={16}/></span><span><PanelsTopLeft size={16}/></span><span><FileText size={16}/></span><span><Users size={16}/></span><span><ShieldCheck size={16}/></span><span><Zap size={16}/></span>
                <span className="mt-auto flex h-8 w-8 items-center justify-center rounded-full border-2 border-orange-400 bg-slate-700 text-[10px] text-white">N</span>
              </aside>
              <div className="min-w-0 flex-1 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><ClipboardCheck size={17}/></span><div><h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">Central de Projetos</h3><p className="text-[10px] text-slate-500 sm:text-xs">6 espaços de trabalho</p></div></div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-[10px] font-semibold text-white sm:px-3 sm:text-xs"><span>+</span> Novo espaço</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <article className="rounded-2xl border border-slate-200 bg-[#f0f1f4] px-3 py-3 shadow-sm sm:px-4"><div className="flex items-start gap-2"><span className="text-slate-400">⠿</span><div><p className="text-xs font-semibold text-slate-800">Rotina de integração</p><p className="mt-2 text-[10px] text-slate-500">Atualizado hoje</p></div><span className="ml-auto text-slate-500">⋮</span></div></article>
                  <article className="rounded-2xl border border-slate-200 bg-[#f0f1f4] px-3 py-3 shadow-sm sm:px-4"><div className="flex items-start gap-2"><span className="text-slate-400">⠿</span><div><p className="text-xs font-semibold text-slate-800">Planejamento mensal</p><p className="mt-2 text-[10px] text-slate-500">Equipe de operações</p></div><span className="ml-auto text-slate-500">⋮</span></div></article>
                  <article className="relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-700 p-3 text-white shadow-sm sm:min-h-[88px] sm:p-4" style={{backgroundImage:"linear-gradient(90deg,rgba(15,23,42,.55),rgba(15,23,42,.08)),url(https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80)",backgroundPosition:"center",backgroundSize:"cover"}}><div><p className="text-xs font-semibold">Integração de equipes</p><p className="mt-1 text-[10px] text-white/85">Materiais e etapas de implantação</p><p className="mt-1 text-[9px] text-white/80">Atualizado recentemente</p></div></article>
                  <article className="relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-700 p-3 text-white shadow-sm sm:min-h-[88px] sm:p-4" style={{backgroundImage:"linear-gradient(90deg,rgba(15,23,42,.55),rgba(15,23,42,.08)),url(https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80)",backgroundPosition:"center",backgroundSize:"cover"}}><div><p className="text-xs font-semibold">Organização interna</p><p className="mt-1 text-[9px] text-white/80">Fluxos e responsabilidades</p></div></article>
                  <article className="relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-700 p-3 text-white shadow-sm sm:min-h-[88px] sm:p-4" style={{backgroundImage:"linear-gradient(90deg,rgba(15,23,42,.6),rgba(15,23,42,.08)),url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=80)",backgroundPosition:"center",backgroundSize:"cover"}}><div><p className="text-xs font-semibold">Indicadores operacionais</p><p className="mt-1 text-[10px] text-white/85">Acompanhamento da rotina</p></div></article>
                  <article className="relative flex min-h-[76px] items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-700 p-3 text-white shadow-sm sm:min-h-[88px] sm:p-4" style={{backgroundImage:"linear-gradient(90deg,rgba(15,23,42,.6),rgba(15,23,42,.08)),url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80)",backgroundPosition:"center",backgroundSize:"cover"}}><div><p className="text-xs font-semibold">Desenvolvimento de processos</p><p className="mt-1 text-[9px] text-white/80">Documentação da equipe</p></div></article>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-1 top-14 z-30 hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl backdrop-blur-md sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={16}/></span><div><p className="text-xs font-bold text-slate-800">Tudo organizado</p><p className="text-[10px] text-slate-500">Projetos e equipes</p></div></div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 text-sm font-medium text-slate-500 md:justify-between md:px-8">
          <span className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Uma plataforma</span><span>Comunicação</span><span>Organização</span><span>Operação</span><span>Indicadores</span><span>Equipes</span>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid items-end gap-5 border-b border-slate-200 pb-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-medium text-blue-700">Funcionalidades</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#111d33] sm:text-4xl">Feita para a rotina da sua equipe.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600">Conheça algumas áreas da plataforma. Use as setas para navegar entre as funcionalidades.</p>
        </div>

        <div className="mt-8 grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
          <div className="min-w-0 border-b border-slate-200 bg-[#f5f6f8] p-3 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-300"/><span className="h-2 w-2 rounded-full bg-slate-300"/><span className="h-2 w-2 rounded-full bg-slate-300"/><span className="ml-2 text-[11px] text-slate-500">Prévia da plataforma</span></div>
              <span className="text-xs tabular-nums text-slate-500">{String(activeFeature+1).padStart(2,"0")} / {String(showcaseFeatures.length).padStart(2,"0")}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex min-h-[330px] sm:min-h-[390px]">
                <aside className="flex w-10 shrink-0 flex-col items-center gap-4 bg-[#1d293f] py-3 text-slate-300 sm:w-12 sm:gap-[18px] sm:py-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs">›</span>
                  <LayoutDashboard size={15}/><MessageSquare size={15}/><Bell size={15}/><CalendarDays size={15}/>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${activeFeature===0 ? "bg-orange-500 text-white" : "text-slate-300"}`}><ClipboardCheck size={15}/></span>
                  <Users size={15}/><ShieldCheck size={15}/>
                </aside>
                <div className="min-w-0 flex-1">
                  {activeFeature===0 ? <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-2 text-xs text-slate-700"><Users size={14}/> <span className="rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">Setores</span><span className="hidden sm:inline">Individual</span><span className="hidden sm:inline">Grupos</span></div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 sm:px-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-500 text-xs font-semibold text-white">G</span><div><p className="text-xs font-semibold text-slate-800">Geral</p><p className="text-[10px] text-slate-500">Canal da equipe</p></div></div><div className="flex gap-3 text-xs text-slate-400"><span>◉</span><span>⌕</span></div></div>
                    <div className="space-y-5 bg-[#f8f9fb] p-3 sm:p-4">
                      <div className="flex items-start gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[9px] font-semibold text-slate-700">MC</span><div><p className="text-[10px] font-semibold text-slate-700">Mariana Costa <span className="ml-1 font-normal text-slate-400">09:14</span></p><div className="mt-1 rounded-r-xl rounded-bl-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-700">Bom dia! A atualização da equipe já está disponível.</div></div></div>
                      <div className="flex items-start justify-end gap-2"><div className="max-w-[85%]"><p className="text-right text-[10px] font-semibold text-slate-700">Você <span className="ml-1 font-normal text-slate-400">09:16</span></p><div className="mt-1 rounded-l-xl rounded-br-xl bg-blue-600 px-3 py-2 text-[11px] leading-5 text-white">Obrigado! Vou compartilhar com o pessoal.</div></div><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-700">VH</span></div>
                    </div>
                    <div className="border-t border-slate-200 p-2"><div className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-400">Mensagem...</div></div>
                  </> : activeFeature===3 ? <>
                    <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 sm:px-4"><div><p className="text-xs font-semibold text-slate-900">Calendário</p><p className="text-[10px] text-slate-500">Agenda e compromissos</p></div><span className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-semibold text-white">+ Evento</span></div>
                    <div className="p-3 sm:p-4">
                      <div className="mb-3 flex items-center justify-between"><button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">‹</button><p className="text-xs font-semibold text-slate-800">Outubro 2026</p><button className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">›</button></div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-slate-500">{["D","S","T","Q","Q","S","S"].map((day,i)=><span key={day+i} className="py-1 font-semibold">{day}</span>)}{Array.from({length:35},(_,i)=>i).map((day)=><span key={day} className={`relative flex h-7 items-center justify-center rounded-md text-[10px] ${[4,9,14,20,22,26].includes(day) ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600"}`}>{day<3?"":day-2}{[4,9,14,20,22,26].includes(day)&&<span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-blue-600"/>}</span>)}</div>
                      <div className="mt-4 rounded-lg border border-slate-200 p-3"><p className="mb-2 text-[11px] font-semibold text-slate-800">Próximos compromissos</p>{[{t:"Reunião de equipe",d:"20 out · 10:00"},{t:"Prazo de entrega",d:"22 out · 15:00"},{t:"Planejamento semanal",d:"26 out · 09:30"}].map((event,i)=><div key={event.t} className="flex items-center gap-2 border-t border-slate-100 py-2"><span className={`h-7 w-1 rounded-full ${["bg-blue-500","bg-amber-400","bg-emerald-500"][i]}`}/><div className="min-w-0 flex-1"><p className="text-[10px] font-medium text-slate-800">{event.t}</p><p className="text-[9px] text-slate-500">{event.d}</p></div></div>)}</div>
                    </div>
                  </> : <>
                    <div className="border-b border-slate-200 px-3 py-3 sm:px-4"><p className="text-xs font-semibold text-slate-900">{activeScreen.heading}</p><p className="mt-1 text-[10px] text-slate-500">{activeScreen.subheading}</p></div>
                    <div className="space-y-3 bg-[#f8f9fb] p-3 sm:p-4">
                      <div className="grid grid-cols-2 gap-2">{activeScreen.metrics.map(([label,value])=><div key={label} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-800">{value}</p></div>)}</div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-[11px] font-semibold text-slate-700">{activeScreen.section}</p>{activeScreen.rows.map((item,i)=><div key={item} className="flex items-center gap-2 border-t border-slate-100 py-3 text-[10px] text-slate-700"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${["bg-blue-50 text-blue-700","bg-amber-50 text-amber-700","bg-emerald-50 text-emerald-700"][i]}`}><currentFeature.icon size={13}/></span><span className="min-w-0 flex-1">{item}</span><span className="text-[9px] text-slate-400">{activeScreen.tags[i]}</span></div>)}</div>
                    </div>
                  </>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Funcionalidade {String(activeFeature+1).padStart(2,"0")}</p>
              <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><currentFeature.icon size={21}/></div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[#111d33]">{currentFeature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{currentFeature.text}</p>
              <p className="mt-4 text-xs leading-5 text-slate-500">Prévia demonstrativa com conteúdo fictício. A disposição representa a experiência da plataforma.</p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
              <div className="flex gap-1.5">{showcaseFeatures.map((item,i)=><button key={item.title} aria-label={`Mostrar ${item.title}`} onClick={()=>setActiveFeature(i)} className={`h-1.5 rounded-full transition-all ${activeFeature===i ? "w-6 bg-blue-700" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}/>)}</div>
              <div className="flex gap-2"><button aria-label="Funcionalidade anterior" onClick={()=>setActiveFeature((activeFeature-1+showcaseFeatures.length)%showcaseFeatures.length)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:border-slate-500 hover:bg-slate-50"><ChevronLeft size={18}/></button><button aria-label="Próxima funcionalidade" onClick={()=>setActiveFeature((activeFeature+1)%showcaseFeatures.length)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#172b4d] text-white transition hover:bg-blue-900"><ChevronRight size={18}/></button></div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-[#101f39] py-20 text-white md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-300">Comece com simplicidade</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Da sua empresa para uma rotina mais organizada.</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">A Nuvexa foi pensada para acompanhar a estrutura da organização, de equipes menores a operações com vários departamentos.</p>
          </div>
          <div className="mx-auto mt-12 max-w-6xl">
            <ol className="divide-y divide-white/15 md:grid md:grid-cols-3 md:divide-y-0 md:divide-x">
              {[{n:"01",title:"Encontre seu ambiente",text:"Informe o nome da empresa para localizar o espaço corporativo."},{n:"02",title:"Acesse sua equipe",text:"Entre com sua conta e visualize os recursos liberados para seu ambiente."},{n:"03",title:"Organize o trabalho",text:"Centralize conversas, demandas e controles da operação."}].map(s=><li key={s.n} className="py-5 md:px-8 md:py-1 md:first:pl-0 md:last:pr-0">
                <div className="flex items-baseline justify-center gap-3 md:justify-start"><span className="font-mono text-xs text-blue-300/80">{s.n}</span><h3 className="text-lg font-medium tracking-tight text-white">{s.title}</h3></div>
                <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-300 md:text-left">{s.text}</p>
              </li>)}
            </ol>
          </div>
          <div className="mt-10 text-center"><Link to="/select-company" className="inline-flex items-center gap-2 border-b border-white/50 pb-2 text-sm font-medium text-white transition hover:border-white hover:text-blue-200">Acessar minha empresa <ArrowRight size={16}/></Link></div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Planos</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111d33] sm:text-4xl">Escolha o plano para sua operação.</h2><p className="mt-4 leading-7 text-slate-600">Compare os recursos, a capacidade e o espaço disponíveis em cada plano.</p></div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map(plan=><article key={plan.name} tabIndex={0} className="group relative min-h-[390px] [perspective:1200px]"><div className="relative h-full min-h-[390px] transition-transform duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus:[transform:rotateY(180deg)]"><div className={`absolute inset-0 flex flex-col rounded-3xl border p-7 [backface-visibility:hidden] ${plan.featured?"border-blue-600 bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-blue-600":"border-slate-200 bg-white shadow-sm"}`}>{plan.featured&&<span className="absolute -top-3 left-6 rounded-full bg-blue-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Mais escolhido</span>}<h3 className="text-xl font-bold text-slate-900">{plan.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p><p className="mt-5 text-3xl font-semibold tracking-tight text-[#172b4d]">{plan.price}<span className="text-sm font-medium text-slate-500">/mês</span></p><p className="mt-1 text-xs text-slate-500">Equivale a {plan.perUser} por usuário/mês na capacidade máxima</p><ul className="my-5 flex-1 space-y-3 text-sm text-slate-600"><li className="flex gap-2"><Users size={17} className="shrink-0 text-blue-700"/>{plan.users}</li><li className="flex gap-2"><Building2 size={17} className="shrink-0 text-blue-700"/>{plan.sectors}</li><li className="flex gap-2"><ShieldCheck size={17} className="shrink-0 text-blue-700"/>{plan.storage} de armazenamento</li></ul><p className="mt-auto text-xs font-medium text-blue-700">Passe o mouse para ver detalhes ↻</p></div><div className="absolute inset-0 flex flex-col justify-center rounded-3xl border border-blue-200 bg-[#122746] p-7 text-white shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-300">Conheça o plano</p><h3 className="mt-3 text-2xl font-semibold">{plan.name}</h3><p className="mt-4 text-sm leading-6 text-slate-200">{plan.detail}</p><div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm text-slate-200"><p>{plan.users}</p><p>{plan.sectors}</p><p>{plan.storage} de armazenamento</p></div><Link to="/select-company" className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-900 transition hover:bg-blue-50">Tenho interesse <ArrowRight size={16}/></Link></div></div></article>)}</div>
        <div className="mt-16">
          <div className="mx-auto max-w-2xl text-center"><h3 className="text-2xl font-semibold tracking-tight text-[#111d33] sm:text-3xl">Compare as funcionalidades</h3><p className="mt-3 text-sm leading-6 text-slate-600">Veja o que está incluído em cada plano.</p></div>
          <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] table-fixed border-collapse text-left text-sm">
              <colgroup><col className="w-[40%]"/><col className="w-[20%]"/><col className="w-[20%]"/><col className="w-[20%]"/></colgroup>
              <thead><tr className="border-b border-slate-200 bg-slate-50"><th className="px-5 py-4 font-semibold text-slate-700">Funcionalidades</th><th className="px-4 py-4 text-center font-semibold text-slate-700">Essencial</th><th className="px-4 py-4 text-center font-semibold text-blue-800">Profissional</th><th className="px-4 py-4 text-center font-semibold text-slate-700">Empresarial</th></tr></thead>
              <tbody>{planFeatures.map(group=><React.Fragment key={group.category}><tr className="border-b border-slate-100"><td colSpan={4} className="p-0"><details className="group/category" open><summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50/80 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-100"><span>{group.category}</span><ChevronRight size={16} className="transition-transform duration-200 group-open/category:rotate-90"/></summary><div><table className="w-full table-fixed border-collapse text-left text-sm"><colgroup><col className="w-[40%]"/><col className="w-[20%]"/><col className="w-[20%]"/><col className="w-[20%]"/></colgroup><tbody>{group.items.map(item=><tr key={item.name} className="border-t border-slate-100 transition hover:bg-slate-50/60"><td className="px-5 py-3.5 text-slate-700">{item.name}</td>{([item.essential,item.professional,item.enterprise]).map((enabled,i)=><td key={i} className="px-4 py-3.5 text-center"><span aria-label={enabled?"Incluído":"Não incluído"} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${enabled?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-600"}`}>{enabled?"✓":"×"}</span></td>)}</tr>)}</tbody></table></div></details></td></tr></React.Fragment>)}</tbody>
            </table></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">✓ Incluído no plano · × Não incluído. Limites de usuários, setores e armazenamento variam conforme o plano.</p>
        </div>
      </section>

      <section className="px-5 pb-20 md:px-8 md:pb-28"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-gradient-to-br from-blue-700 to-[#172b4d] p-8 text-white shadow-2xl shadow-blue-900/15 sm:p-12 md:flex-row md:items-center"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-200">Nuvexa · Gestão de operações</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sua equipe pode trabalhar com mais clareza.</h2><p className="mt-3 leading-7 text-blue-100">Centralize informações, conecte departamentos e dê mais visibilidade à rotina.</p></div><Link to="/auth" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-800 transition hover:bg-blue-50">Começar agora <ArrowRight size={16}/></Link></div></section>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8"><span>© {new Date().getFullYear()} Nuvexa. Gestão de operações.</span><div className="flex gap-5"><a href="#recursos" className="hover:text-blue-700">Recursos</a><a href="#planos" className="hover:text-blue-700">Planos</a><Link to="/select-company" className="hover:text-blue-700">Entrar</Link></div></div></footer>
    </main>
  );
}
