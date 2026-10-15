import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown,
  CircleHelp, Clock3, Command, FileText, Filter, LayoutDashboard, LogOut, Menu, MessageCircle,
  MoreHorizontal, Plus, Search, Send, Settings2, ShieldCheck, Sparkles, SquareKanban, Users,
  X, Building2, ClipboardList, Megaphone, PanelLeftClose, PanelLeftOpen, CircleUserRound,
  CalendarCheck, MessageSquareText, Timer, LockKeyhole, Database, ArrowRight, ListTodo
} from "lucide-react";

const PREFIX = "nuvexa-demo:v2:";
const SESSION_KEY = PREFIX + "session-start";
const EXPIRED_KEY = PREFIX + "session-expired";
const DURATION_MS = 3 * 60 * 60 * 1000;

type Task = { id: string; title: string; owner: string; status: "Novo" | "Em andamento" | "Concluído"; due: string; priority: "Normal" | "Alta" };
type Message = { id: string; author: string; initials: string; time: string; text: string };
type Announcement = { id: string; title: string; body: string; date: string };

const initialTasks: Task[] = [
  { id: "t1", title: "Revisar solicitações pendentes", owner: "Mariana Costa", status: "Em andamento", due: "Hoje", priority: "Alta" },
  { id: "t2", title: "Atualizar comunicado da equipe", owner: "Rafael Martins", status: "Novo", due: "Hoje", priority: "Normal" },
  { id: "t3", title: "Conferir checklist operacional", owner: "Ana Souza", status: "Concluído", due: "Ontem", priority: "Normal" },
  { id: "t4", title: "Organizar pauta da reunião", owner: "Você", status: "Novo", due: "Amanhã", priority: "Normal" },
];
const initialMessages: Message[] = [
  { id: "m1", author: "Mariana Costa", initials: "MC", time: "09:14", text: "Bom dia! A atualização da equipe já está disponível." },
  { id: "m2", author: "Rafael Martins", initials: "RM", time: "09:18", text: "Obrigado, vou conferir as pendências ainda hoje." },
  { id: "m3", author: "Ana Souza", initials: "AS", time: "09:23", text: "Deixei os documentos da reunião no mural." },
];
const initialAnnouncements: Announcement[] = [
  { id: "a1", title: "Reunião semanal de operações", body: "Quinta-feira, às 10h. Sala de reuniões.", date: "Hoje" },
  { id: "a2", title: "Atualização de procedimentos", body: "Consulte os procedimentos atualizados antes de iniciar as atividades.", date: "Ontem" },
];
const navGroups = [
  { title: "PRINCIPAL", items: [
    { id: "home", label: "Início", icon: LayoutDashboard },
    { id: "chat", label: "Chat por Setores", icon: MessageCircle, count: "3" },
    { id: "announcements", label: "Avisos Gerais", icon: Megaphone },
    { id: "birthdays", label: "Aniversariantes", icon: CalendarDays },
    { id: "tasks", label: "Gestão de Tarefas", icon: SquareKanban },
    { id: "calendar", label: "Calendário", icon: CalendarCheck },
  ]},
  { title: "GESTÃO", items: [
    { id: "people", label: "Gestão de Pessoas", icon: Users },
    { id: "evaluations", label: "Avaliações", icon: ClipboardList },
    { id: "hours", label: "Banco de Horas", icon: Clock3 },
    { id: "indicators", label: "Indicadores", icon: Activity },
  ]},
];
function readLocal<T,>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {} }
function timeLabel(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map(v => String(v).padStart(2, "0")).join(":");
}
const sectionMeta: Record<string, { title: string; subtitle: string }> = {
  home: { title: "Início", subtitle: "Visão geral do Nuvexa" },
  chat: { title: "Chat por Setores", subtitle: "Comunicação entre equipes" },
  announcements: { title: "Avisos Gerais", subtitle: "Comunicados e atualizações da empresa" },
  birthdays: { title: "Aniversariantes", subtitle: "Celebre as pessoas da equipe" },
  tasks: { title: "Gestão de Tarefas", subtitle: "Organize atividades, responsáveis e prazos" },
  calendar: { title: "Calendário", subtitle: "Reuniões, lembretes e prazos" },
  people: { title: "Gestão de Pessoas", subtitle: "Equipe e informações de colaboradores" },
  evaluations: { title: "Avaliações", subtitle: "Acompanhamento e feedback da equipe" },
  hours: { title: "Banco de Horas", subtitle: "Acompanhamento demonstrativo de horas" },
  indicators: { title: "Indicadores", subtitle: "Resumo das operações" },
};
export default function DemoMode() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [active, setActive] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tasks, setTasks] = useState<Task[]>(() => readLocal("tasks", initialTasks));
  const [messages, setMessages] = useState<Message[]>(() => readLocal("messages", initialMessages));
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => readLocal("announcements", initialAnnouncements));
  const [search, setSearch] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(EXPIRED_KEY) === "1") { setExpired(true); return; }
    const start = Number(localStorage.getItem(SESSION_KEY));
    if (start && Date.now() - start < DURATION_MS) setStarted(true);
    else if (start) { localStorage.setItem(EXPIRED_KEY, "1"); localStorage.removeItem(SESSION_KEY); setExpired(true); }
  }, []);
  useEffect(() => { if (!started) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [started]);
  useEffect(() => { writeLocal("tasks", tasks); }, [tasks]);
  useEffect(() => { writeLocal("messages", messages); }, [messages]);
  useEffect(() => { writeLocal("announcements", announcements); }, [announcements]);
  const startedAt = Number(typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : 0);
  const remaining = startedAt ? DURATION_MS - (now - startedAt) : DURATION_MS;
  useEffect(() => {
    if (started && remaining <= 0) { setStarted(false); setExpired(true); localStorage.setItem(EXPIRED_KEY, "1"); localStorage.removeItem(SESSION_KEY); }
  }, [started, remaining]);

  const begin = () => {
    if (localStorage.getItem(EXPIRED_KEY) === "1") { setExpired(true); return; }
    const start = Date.now(); localStorage.setItem(SESSION_KEY, String(start)); setNow(start); setStarted(true);
  };
  const leave = () => { setStarted(false); navigate("/"); };
  const addTask = () => {
    if (!taskDraft.trim()) return;
    setTasks(old => [{ id: crypto.randomUUID(), title: taskDraft.trim(), owner: "Você", status: "Novo", due: "Hoje", priority: "Normal" }, ...old]);
    setTaskDraft(""); setShowTaskForm(false);
  };
  const addMessage = () => {
    if (!messageDraft.trim()) return;
    setMessages(old => [...old, { id: crypto.randomUUID(), author: "Você", initials: "VH", time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), text: messageDraft.trim() }]);
    setMessageDraft("");
  };
  const addAnnouncement = () => {
    if (!announcementDraft.trim()) return;
    setAnnouncements(old => [{ id: crypto.randomUUID(), title: announcementDraft.trim(), body: "Comunicado criado neste ambiente de demonstração.", date: "Agora" }, ...old]);
    setAnnouncementDraft(""); setShowAnnouncementForm(false);
  };
  const filteredTasks = useMemo(() => tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())), [tasks, search]);
  const meta = sectionMeta[active] || sectionMeta.home;

  if (!started && !expired) return <div className="min-h-screen bg-[#f3f5f9] px-4 py-8 text-[#17243b]">
    <div className="mx-auto flex min-h-[85vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-[28px] border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-30px_rgba(19,38,70,.28)] sm:p-10">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#172b4d] text-white"><Building2 size={22}/></div><div><p className="text-lg font-bold tracking-tight">Nuvexa</p><p className="text-xs text-slate-500">Gestão de operações</p></div></div>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"><ShieldCheck size={14}/> Ambiente demonstrativo isolado</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Explore o Nuvexa na prática.</h1>
        <p className="mt-4 leading-7 text-slate-600">Experimente uma demonstração navegável com dados fictícios e aparência baseada no sistema original. O ambiente fica disponível por até 3 horas neste navegador.</p>
        <div className="mt-7 space-y-3">
          <div className="flex gap-3 rounded-2xl border border-slate-200 p-4"><Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"/><div><p className="text-sm font-semibold">Dados locais</p><p className="mt-1 text-sm leading-6 text-slate-500">Tarefas, mensagens e avisos de teste ficam no armazenamento local deste navegador. Nada é enviado ao banco de dados do sistema real.</p></div></div>
          <div className="flex gap-3 rounded-2xl border border-slate-200 p-4"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"/><div><p className="text-sm font-semibold">Separado da plataforma real</p><p className="mt-1 text-sm leading-6 text-slate-500">Esta rota não carrega os provedores de autenticação e empresa nem executa consultas do Supabase.</p></div></div>
          <div className="flex gap-3 rounded-2xl border border-slate-200 p-4"><Timer className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"/><div><p className="text-sm font-semibold">Até 3 horas de acesso</p><p className="mt-1 text-sm leading-6 text-slate-500">O prazo fica registrado neste navegador e a sessão é encerrada automaticamente ao terminar.</p></div></div>
        </div>
        <button onClick={begin} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#172b4d] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#203c68]">Entrar na demonstração <ArrowRight size={17}/></button>
        <button onClick={() => navigate("/")} className="mt-3 w-full rounded-xl px-5 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50">Voltar ao site</button>
        <p className="mt-4 text-center text-xs text-slate-400">A demonstração não representa dados reais de uma empresa.</p>
      </div>
    </div>
  </div>;

  if (expired) return <div className="flex min-h-screen items-center justify-center bg-[#f3f5f9] px-4 text-[#17243b]"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Clock3 size={26}/></div><h1 className="mt-5 text-2xl font-semibold">Seu período de teste terminou</h1><p className="mt-3 text-sm leading-6 text-slate-500">As três horas de demonstração foram utilizadas neste navegador. Você pode voltar ao site e conhecer as opções de acesso ao Nuvexa.</p><button onClick={leave} className="mt-6 w-full rounded-xl bg-[#172b4d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#203c68]">Voltar ao site</button></div></div>;

  return <div className="flex h-screen overflow-hidden bg-[#f3f5f9] text-slate-800">
    <aside className={`${sidebarOpen ? "w-[258px]" : "w-[76px]"} relative z-20 hidden shrink-0 flex-col border-r border-[#24395a] bg-[#172b4d] text-white transition-[width] duration-200 md:flex`}>
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Building2 size={21}/></div>
        {sidebarOpen && <div className="min-w-0"><p className="text-[17px] font-bold tracking-tight">Nuvexa</p><p className="text-[10px] tracking-wide text-blue-100/70">GESTÃO DE OPERAÇÕES</p></div>}
        <button aria-label="Recolher menu" onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto rounded-lg p-1.5 text-blue-100/70 hover:bg-white/10 hover:text-white">{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
      </div>
      <div className="border-b border-white/10 px-4 py-4"><div className="flex items-center gap-3 rounded-xl bg-white/[0.07] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8edf8] text-xs font-bold text-[#172b4d]">VH</div>{sidebarOpen && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Vitor Hugo</p><p className="truncate text-[11px] text-blue-100/65">Administrador de teste</p></div>}{sidebarOpen && <ChevronDown size={14} className="text-blue-100/60"/>}</div></div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map(group => <div key={group.title} className="mb-5"><p className={`mb-2 px-3 text-[10px] font-semibold tracking-[.15em] text-blue-100/45 ${sidebarOpen ? "" : "text-center"}`}>{sidebarOpen ? group.title : "···"}</p>{group.items.map(item => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} title={!sidebarOpen ? item.label : undefined} onClick={() => setActive(item.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${selected ? "bg-white text-[#172b4d] font-semibold shadow-sm" : "text-blue-50/80 hover:bg-white/10 hover:text-white"} `}><Icon size={17} className="shrink-0"/>{sidebarOpen && <><span className="flex-1">{item.label}</span>{item.count && <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${selected ? "bg-blue-50 text-blue-700" : "bg-white/10 text-blue-50"}`}>{item.count}</span>}</>}</button>; })}</div>)}
        <div className="mb-5"><p className={`mb-2 px-3 text-[10px] font-semibold tracking-[.15em] text-blue-100/45 ${sidebarOpen ? "" : "text-center"}`}>{sidebarOpen ? "SISTEMA" : "···"}</p><button onClick={() => setActive("settings")} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-blue-50/80 hover:bg-white/10 ${active === "settings" ? "bg-white/10 text-white" : ""}`}><Settings2 size={17}/>{sidebarOpen && "Configurações"}</button></div>
      </nav>
      <div className="border-t border-white/10 p-3"><div className={`mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 ${sidebarOpen ? "" : "hidden"}`}><div className="flex items-center gap-2 text-[11px] font-semibold text-amber-100"><Timer size={14}/> Teste grátis</div><p className="mt-1 text-[11px] text-blue-100/70">Tempo restante</p><p className="mt-1 font-mono text-lg font-semibold tracking-wider text-white">{timeLabel(remaining)}</p></div><button onClick={leave} title="Sair da demonstração" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-blue-50/75 hover:bg-white/10 hover:text-white"><LogOut size={17}/>{sidebarOpen && "Sair da demonstração"}</button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-10 flex min-h-[76px] items-center gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-7">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 md:hidden"><Menu size={20}/></button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[11px] text-slate-400"><span>Nuvexa</span><span>/</span><span className="text-slate-500">{meta.title}</span></div><h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-[#172b4d] sm:text-xl">{meta.title}</h1><p className="hidden text-xs text-slate-500 sm:block">{meta.subtitle}</p></div>
        <div className="hidden max-w-[250px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex"><Search size={15} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar no ambiente..." className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"/><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">⌘ K</kbd></div>
        <div className="flex items-center gap-2"><div className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>{timeLabel(remaining)}</div><button title="Ajuda da demonstração" className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"><CircleHelp size={18}/></button><button title="Notificações fictícias" onClick={() => setActive("announcements")} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"><Bell size={18}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-600 ring-2 ring-white"/></button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8edf8] text-xs font-bold text-[#172b4d]">VH</div></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#172b4d]">{active === "home" ? "Olá, Vitor 👋" : meta.title}</h2><p className="mt-1 text-sm text-slate-500">{active === "home" ? "Aqui está o resumo das atividades da sua operação." : meta.subtitle}</p></div><div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><Sparkles size={15}/> Demonstração com dados fictícios</div></div>
          {active === "home" && <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Tarefas totais", value: String(tasks.length).padStart(2, "0"), note: "No quadro de atividades", icon: ListTodo, trend: "+2 esta semana", up: true },
                { label: "Em andamento", value: String(tasks.filter(t => t.status === "Em andamento").length).padStart(2, "0"), note: "Atividades em execução", icon: Activity, trend: "Acompanhamento", up: true },
                { label: "Mensagens", value: String(messages.length + 24).padStart(2, "0"), note: "Conversas de demonstração", icon: MessageSquareText, trend: "Ativo hoje", up: true },
                { label: "Comunicados", value: String(announcements.length).padStart(2, "0"), note: "Publicados no mural", icon: Megaphone, trend: "Atualizado", up: false },
              ].map((stat, i) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_3px_16px_-12px_rgba(15,35,65,.25)]"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2fb] text-[#31558b]"><Icon size={19}/></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={18}/></button></div><p className="mt-4 text-sm text-slate-500">{stat.label}</p><div className="mt-1 flex items-end justify-between"><p className="text-3xl font-semibold tracking-tight text-[#172b4d]">{stat.value}</p><span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600">{stat.up ? <ArrowUpRight size={13}/> : <Check size={13}/>} {stat.trend}</span></div><p className="mt-2 text-[11px] text-slate-400">{stat.note}</p></div>; })}
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.85fr)]">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-[#172b4d]">Tarefas recentes</h3><p className="mt-1 text-xs text-slate-500">Acompanhe as atividades da equipe</p></div><button onClick={() => setActive("tasks")} className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Ver quadro <ArrowRight size={14}/></button></div><div className="divide-y divide-slate-100">{tasks.slice(0,4).map(task => <div key={task.id} className="flex items-center gap-3 px-5 py-4"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${task.status === "Concluído" ? "bg-emerald-500" : task.status === "Em andamento" ? "bg-blue-500" : "bg-amber-400"}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700">{task.title}</p><p className="mt-1 text-xs text-slate-400">{task.owner} · {task.due}</p></div><span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${task.status === "Concluído" ? "bg-emerald-50 text-emerald-700" : task.status === "Em andamento" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{task.status}</span></div>)}</div><div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3"><button onClick={() => { setActive("tasks"); setShowTaskForm(true); }} className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700"><Plus size={15}/> Criar nova tarefa</button></div></section>
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-[#172b4d]">Mural de avisos</h3><p className="mt-1 text-xs text-slate-500">Comunicados recentes</p></div><button onClick={() => setActive("announcements")} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><ArrowRight size={16}/></button></div><div className="space-y-3 p-4">{announcements.slice(0,3).map(a => <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf0fb] text-blue-700"><Megaphone size={16}/></div><div className="min-w-0"><p className="text-sm font-semibold text-slate-700">{a.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{a.body}</p><p className="mt-2 text-[10px] text-slate-400">{a.date}</p></div></div></div>)}</div></section>
            </div>
            <section className="rounded-2xl border border-slate-200/80 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-[#172b4d]">Comunicação da equipe</h3><p className="mt-1 text-xs text-slate-500">Prévia das últimas mensagens</p></div><button onClick={() => setActive("chat")} className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Abrir chat <ArrowRight size={14}/></button></div><div className="grid gap-4 p-5 md:grid-cols-3">{messages.slice(-3).reverse().map(m => <div key={m.id} className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{m.initials}</div><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-slate-700">{m.author}</p><span className="text-[10px] text-slate-400">{m.time}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{m.text}</p></div></div>)}</div></section>
          </div>}
          {active === "tasks" && <section className="rounded-2xl border border-slate-200/80 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h3 className="font-semibold text-[#172b4d]">Quadro de tarefas</h3><p className="mt-1 text-xs text-slate-500">Dados editáveis apenas nesta demonstração</p></div><button onClick={() => setShowTaskForm(!showTaskForm)} className="flex items-center gap-2 rounded-xl bg-[#172b4d] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#203c68]"><Plus size={15}/> Nova tarefa</button></div>{showTaskForm && <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row"><input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Descreva a nova tarefa..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"/><button onClick={addTask} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Adicionar</button></div>}<div className="grid gap-4 p-4 lg:grid-cols-3">{(["Novo","Em andamento","Concluído"] as const).map(status => <div key={status} className="rounded-xl bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between px-1"><span className="text-xs font-semibold text-slate-600">{status}</span><span className="rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-500">{filteredTasks.filter(t => t.status === status).length}</span></div><div className="space-y-3">{filteredTasks.filter(t => t.status === status).map(t => <article key={t.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium leading-5 text-slate-700">{t.title}</p><button title="Marcar concluída" onClick={() => setTasks(old => old.map(item => item.id === t.id ? { ...item, status: item.status === "Concluído" ? "Novo" : "Concluído" } : item))} className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><CheckCheck size={16}/></button></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="flex items-center gap-1.5 text-[11px] text-slate-500"><CircleUserRound size={13}/>{t.owner}</span><span className="flex items-center gap-1 text-[10px] text-slate-400"><Clock3 size={12}/>{t.due}</span></div>{t.priority === "Alta" && <span className="mt-3 inline-flex rounded-md bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-600">Prioridade alta</span>}</article>)}</div></div>)}</div></section>}
          {active === "chat" && <section className="flex h-[min(680px,calc(100vh-180px))] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="flex items-center gap-3 border-b border-slate-100 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2fb] text-blue-700"><MessageCircle size={19}/></div><div><h3 className="text-sm font-semibold text-[#172b4d]">Setor Administrativo</h3><p className="mt-1 text-[11px] text-emerald-600">Canal de demonstração · 4 participantes</p></div><button className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={18}/></button></div><div className="flex-1 space-y-5 overflow-y-auto bg-[#f8f9fc] p-4 sm:p-6">{messages.map(m => <div key={m.id} className={`flex gap-3 ${m.author === "Você" ? "flex-row-reverse" : ""}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-600 shadow-sm">{m.initials}</div><div className={`max-w-[80%] ${m.author === "Você" ? "text-right" : ""}`}><div className={`mb-1 flex items-center gap-2 ${m.author === "Você" ? "justify-end" : ""}`}><span className="text-[11px] font-semibold text-slate-600">{m.author}</span><span className="text-[10px] text-slate-400">{m.time}</span></div><div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${m.author === "Você" ? "rounded-tr-sm bg-[#1e3a64] text-white" : "rounded-tl-sm border border-slate-100 bg-white text-slate-600"}`}>{m.text}</div></div></div>)}</div><form onSubmit={e => { e.preventDefault(); addMessage(); }} className="flex items-center gap-2 border-t border-slate-100 p-3 sm:p-4"><input value={messageDraft} onChange={e => setMessageDraft(e.target.value)} placeholder="Escreva uma mensagem..." className="min-w-0 flex-1 rounded-xl bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"/><button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#172b4d] text-white hover:bg-[#203c68]"><Send size={17}/></button></form></section>}
          {active === "announcements" && <section className="rounded-2xl border border-slate-200/80 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h3 className="font-semibold text-[#172b4d]">Mural de comunicados</h3><p className="mt-1 text-xs text-slate-500">Publicações fictícias deste ambiente</p></div><button onClick={() => setShowAnnouncementForm(!showAnnouncementForm)} className="flex items-center gap-2 rounded-xl bg-[#172b4d] px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15}/> Novo comunicado</button></div>{showAnnouncementForm && <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row"><input value={announcementDraft} onChange={e => setAnnouncementDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && addAnnouncement()} placeholder="Título do comunicado..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"/><button onClick={addAnnouncement} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">Publicar</button></div>}<div className="grid gap-4 p-5 md:grid-cols-2">{announcements.map(a => <article key={a.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf2fb] text-blue-700"><Megaphone size={18}/></div><div><p className="font-semibold text-slate-700">{a.title}</p><p className="mt-2 text-sm leading-6 text-slate-500">{a.body}</p><p className="mt-3 text-[11px] text-slate-400">{a.date}</p></div></div></article>)}</div></section>}
          {active !== "home" && active !== "tasks" && active !== "chat" && active !== "announcements" && <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2fb] text-[#31558b]"><Settings2 size={22}/></div><h3 className="mt-4 text-lg font-semibold text-[#172b4d]">{meta.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Esta área faz parte da navegação demonstrativa do Nuvexa. Os dados apresentados aqui são ilustrativos e não se conectam a usuários, empresas ou registros reais.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{icon:Users,title:"Equipe de demonstração",value:"12 colaboradores"},{icon:CalendarDays,title:"Próximo compromisso",value:"Reunião semanal · 10h"},{icon:FileText,title:"Registros de exemplo",value:"Dados fictícios"}].map(item => {const Icon=item.icon; return <div key={item.title} className="rounded-xl border border-slate-200 p-4"><Icon size={18} className="text-blue-700"/><p className="mt-3 text-xs text-slate-500">{item.title}</p><p className="mt-1 text-sm font-semibold text-slate-700">{item.value}</p></div>;})}</div></section>}
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-400"><span>© Nuvexa · Ambiente de demonstração</span><span className="flex items-center gap-1.5"><ShieldCheck size={13}/> Isolado do sistema real · {timeLabel(remaining)} restantes</span></footer>
        </div>
      </main>
    </div>
  </div>;
}
