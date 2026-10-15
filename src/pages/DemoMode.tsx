import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, BarChart3, Bell, CalendarDays, Check, CheckSquare, ChevronLeft, ChevronRight,
  Clock3, FileText, LayoutDashboard, LogOut, MessageSquare, Plus, Search, Settings,
  ShieldCheck, Smartphone, Users, Workflow, X, Building2, ClipboardCheck, Send, Trash2,
  LockKeyhole, Info, TimerReset, Database
} from "lucide-react";

const PREFIX = "nuvexa-demo:v1:";
const SESSION_KEY = PREFIX + "session-start";
const SESSION_EXPIRED_KEY = PREFIX + "session-expired";
const DURATION_MS = 3 * 60 * 60 * 1000;
const DEFAULT_TASKS = [
  { id: "t1", title: "Revisar solicitação interna", owner: "Mariana Costa", status: "Em andamento", date: "Hoje" },
  { id: "t2", title: "Atualizar comunicado da equipe", owner: "Rafael Martins", status: "Novo", date: "Hoje" },
  { id: "t3", title: "Conferir pendências do setor", owner: "Ana Souza", status: "Concluído", date: "Ontem" },
];
const DEFAULT_MESSAGES = [
  { id: "m1", author: "Mariana Costa", initials: "MC", time: "09:14", text: "Bom dia! A atualização da equipe já está disponível." },
  { id: "m2", author: "Rafael Martins", initials: "RM", time: "09:18", text: "Obrigado, vou conferir as pendências ainda hoje." },
  { id: "m3", author: "Você", initials: "VH", time: "09:21", text: "Perfeito. Vou atualizar o quadro depois da reunião." },
];
const NAV = [
  { label: "Visão geral", icon: LayoutDashboard }, { label: "Comunicação", icon: MessageSquare },
  { label: "Mural e comunicados", icon: Bell }, { label: "Gestão de tarefas", icon: CheckSquare },
  { label: "Calendário", icon: CalendarDays }, { label: "Aniversariantes", icon: Users },
  { label: "Avaliações", icon: ClipboardCheck }, { label: "Banco de horas", icon: Clock3 },
  { label: "Indicadores", icon: BarChart3 }, { label: "Equipe e setores", icon: Users },
  { label: "Documentos", icon: FileText }, { label: "Configurações", icon: Settings },
];
function readLocal<T,>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function saveLocal(key: string, value: unknown) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* armazenamento local indisponível */ }
}
function remainingText(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function DemoMode() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [expired, setExpired] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [active, setActive] = useState("Visão geral");
  const [tasks, setTasks] = useState(() => readLocal("tasks", DEFAULT_TASKS));
  const [messages, setMessages] = useState(() => readLocal("messages", DEFAULT_MESSAGES));
  const [announcements, setAnnouncements] = useState(() => readLocal("announcements", [
    { id: "a1", title: "Reunião semanal de operações", body: "Quinta-feira, às 10h. Sala de reuniões." },
    { id: "a2", title: "Atualização de procedimentos", body: "Consulte os procedimentos atualizados antes de iniciar as atividades." },
  ]));
  const [draft, setDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (localStorage.getItem(SESSION_EXPIRED_KEY) === "1") { setExpired(true); return; }
    const startedAt = Number(localStorage.getItem(SESSION_KEY));
    if (startedAt && Date.now() - startedAt < DURATION_MS) setStarted(true);
    else if (startedAt) { setExpired(true); localStorage.setItem(SESSION_EXPIRED_KEY, "1"); localStorage.removeItem(SESSION_KEY); }
  }, []);
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [started]);
  useEffect(() => { saveLocal("tasks", tasks); }, [tasks]);
  useEffect(() => { saveLocal("messages", messages); }, [messages]);
  useEffect(() => { saveLocal("announcements", announcements); }, [announcements]);

  const startedAt = Number(typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : 0);
  const remaining = startedAt ? DURATION_MS - (now - startedAt) : DURATION_MS;
  useEffect(() => {
    if (started && remaining <= 0) {
      setStarted(false); setExpired(true);
      localStorage.setItem(SESSION_EXPIRED_KEY, "1");
      localStorage.removeItem(SESSION_KEY);
    }
  }, [started, remaining]);

  const begin = () => {
    if (localStorage.getItem(SESSION_EXPIRED_KEY) === "1") { setExpired(true); return; }
    const time = Date.now();
    localStorage.setItem(SESSION_KEY, String(time));
    setNow(time); setExpired(false); setStarted(true);
  };
  const leaveDemo = () => {
    setStarted(false);
    navigate("/");
  };
  const addTask = () => {
    if (!taskDraft.trim()) return;
    setTasks(old => [{ id: crypto.randomUUID(), title: taskDraft.trim(), owner: "Você", status: "Novo", date: "Hoje" }, ...old]);
    setTaskDraft("");
  };
  const addMessage = () => {
    if (!messageDraft.trim()) return;
    setMessages(old => [...old, { id: crypto.randomUUID(), author: "Você", initials: "VH", time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), text: messageDraft.trim() }]);
    setMessageDraft("");
  };
  const addAnnouncement = () => {
    if (!announcementDraft.trim()) return;
    setAnnouncements(old => [{ id: crypto.randomUUID(), title: announcementDraft.trim(), body: "Comunicado criado neste ambiente de demonstração." }, ...old]);
    setAnnouncementDraft("");
  };
  const visibleTasks = useMemo(() => tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())), [tasks, search]);

  if (!started && !expired) return <div className="min-h-screen bg-[#f4f6fa] px-4 py-10 text-[#17243b]">
    <div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#172b4d] text-white"><LockKeyhole size={22}/></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-blue-700">Nuvexa · ambiente demonstrativo</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Teste a plataforma com segurança.</h1>
        <p className="mt-4 leading-7 text-slate-600">Este é um ambiente de demonstração separado do sistema real. Você poderá explorar as principais áreas e criar dados de exemplo durante até 3 horas neste navegador.</p>
        <div className="mt-6 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700">
          <p className="flex gap-3"><Database className="mt-1 h-4 w-4 shrink-0 text-blue-700"/><span><strong>Dados apenas neste navegador.</strong> Tarefas, mensagens e comunicados criados aqui ficam no armazenamento local do navegador e não são enviados ao banco de dados da Nuvexa.</span></p>
          <p className="flex gap-3"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-blue-700"/><span><strong>Separação do sistema real.</strong> Este ambiente não utiliza a autenticação, empresas, usuários ou tabelas do sistema de produção.</span></p>
          <p className="flex gap-3"><TimerReset className="mt-1 h-4 w-4 shrink-0 text-blue-700"/><span><strong>Limite de 3 horas.</strong> O prazo é contado neste perfil de navegador. Limpar os dados do navegador pode apagar o teste e reiniciar o contador; por isso, não é um bloqueio inviolável por hardware.</span></p>
          <p className="flex gap-3"><Info className="mt-1 h-4 w-4 shrink-0 text-blue-700"/><span>Use somente informações fictícias. Algumas integrações e funções que dependem de serviços externos não estarão disponíveis nesta demonstração.</span></p>
        </div>
        {expired && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">O período desta sessão de demonstração terminou. Inicie um novo teste para continuar.</p>}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button onClick={begin} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#172b4d] px-5 text-sm font-semibold text-white transition hover:bg-[#213c68]">Entrar no teste grátis <ChevronRight size={17}/></button>
          <button onClick={() => navigate("/")} className="h-12 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar ao site</button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Dados fictícios · Armazenamento local · Sem conexão com o banco de produção</p>
      </div>
    </div>
  </div>;

  if (remaining <= 0 || expired) return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl"><TimerReset className="mx-auto h-10 w-10 text-amber-600"/><h1 className="mt-4 text-2xl font-semibold">Seu teste terminou</h1><p className="mt-3 text-sm leading-6 text-slate-600">As três horas de demonstração chegaram ao fim. Seus dados de exemplo permaneceram apenas neste navegador.</p><button onClick={leaveDemo} className="mt-6 rounded-xl bg-[#172b4d] px-5 py-3 text-sm font-semibold text-white">Voltar para Nuvexa</button></div></div>;

  const Icon = NAV.find(item => item.label === active)?.icon ?? LayoutDashboard;
  return <div className="min-h-screen bg-[#f5f6f8] text-[#1c2738]">
    <aside className="fixed inset-y-3 left-3 z-20 hidden w-[72px] flex-col items-center rounded-[26px] bg-[#1d293f] py-3 text-slate-300 shadow-lg lg:flex">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><Activity size={19}/></div>
      <div className="mb-3 h-px w-full bg-white/10"/>
      <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">{NAV.map(item => {const I=item.icon;return <button key={item.label} title={item.label} onClick={()=>setActive(item.label)} className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl transition ${active===item.label?"bg-orange-500 text-white":"hover:bg-white/10 hover:text-white"}`}><I size={18}/></button>})}</nav>
      <div className="mt-2 rounded-full border border-white/15 px-2 py-1 text-[9px] font-semibold text-emerald-300">DEMO</div>
    </aside>
    <div className="lg:pl-[96px]">
      <header className="sticky top-0 z-10 flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172b4d] text-white"><Activity size={19}/></div><div><div className="font-semibold tracking-tight">nuvexa<span className="text-blue-600">.</span> <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">Teste</span></div><p className="text-xs text-slate-500">Ambiente isolado · dados locais</p></div></div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-[10px] uppercase tracking-wide text-slate-400">Tempo restante</p><p className="font-mono text-sm font-semibold text-slate-700">{remainingText(remaining)}</p></div><button onClick={leaveDemo} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><LogOut size={15}/> Sair</button></div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 md:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Ambiente de demonstração</p><h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{active}</h1><p className="mt-1 text-sm text-slate-500">Explore as áreas da Nuvexa usando dados de exemplo.</p></div><div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><ShieldCheck size={15}/> Isolado do sistema real</div></div>
        {active==="Visão geral" && <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Tarefas abertas",value:tasks.filter(t=>t.status!=="Concluído").length,icon:CheckSquare},{label:"Mensagens",value:messages.length,icon:MessageSquare},{label:"Comunicados",value:announcements.length,icon:Bell},{label:"Setores ativos",value:"04",icon:Users}].map(k=>{const I=k.icon;return <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><I size={18}/></div><p className="mt-4 text-sm text-slate-500">{k.label}</p><p className="mt-1 text-3xl font-semibold">{k.value}</p></div>})}</div><div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Demandas recentes</h2><div className="mt-4 divide-y divide-slate-100">{tasks.slice(0,4).map(t=><div key={t.id} className="flex items-center gap-3 py-3"><span className={`h-2 w-2 rounded-full ${t.status==="Concluído"?"bg-emerald-500":t.status==="Novo"?"bg-blue-500":"bg-amber-400"}`}/><span className="flex-1 text-sm">{t.title}</span><span className="text-xs text-slate-500">{t.status}</span></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Atividade da equipe</h2><p className="mt-2 text-sm leading-6 text-slate-500">Mensagens, tarefas e comunicados ficam salvos somente neste navegador durante a demonstração.</p><button onClick={()=>setActive("Comunicação")} className="mt-4 text-sm font-semibold text-blue-700">Abrir comunicação →</button></div></div></div>}
        {active==="Gestão de tarefas" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Quadro de tarefas</h2><p className="mt-1 text-sm text-slate-500">Adicione e atualize demandas fictícias.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar tarefa" className="h-10 rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400"/></div></div><form onSubmit={e=>{e.preventDefault();addTask()}} className="mt-4 flex gap-2"><input value={taskDraft} onChange={e=>setTaskDraft(e.target.value)} placeholder="Nome da nova tarefa" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"/><button className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white"><Plus size={16}/> Adicionar</button></form><div className="mt-5 grid gap-4 md:grid-cols-3">{["Novo","Em andamento","Concluído"].map(status=><div key={status} className="rounded-xl bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between text-sm font-semibold">{status}<span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{visibleTasks.filter(t=>t.status===status).length}</span></div>{visibleTasks.filter(t=>t.status===status).map(t=><div key={t.id} className="mb-2 rounded-xl border border-slate-200 bg-white p-3"><p className="text-sm font-medium">{t.title}</p><p className="mt-2 text-xs text-slate-500">{t.owner} · {t.date}</p><div className="mt-3 flex items-center gap-1">{["Novo","Em andamento","Concluído"].filter(s=>s!==t.status).map(s=><button key={s} onClick={()=>setTasks(old=>old.map(x=>x.id===t.id?{...x,status:s}:x))} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600 hover:bg-blue-50">{s}</button>)}<button title="Excluir" onClick={()=>setTasks(old=>old.filter(x=>x.id!==t.id))} className="ml-auto rounded-md p-1 text-slate-400 hover:text-red-600"><Trash2 size={13}/></button></div></div>)}</div>)}</div></div>}
        {active==="Comunicação" && <div className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[220px_1fr]"><aside className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Setores</p>{["Geral","Admissão","Folha","Mesa Operacional"].map((s,i)=><button key={s} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${i===0?"bg-blue-50 font-medium text-blue-700":"text-slate-600 hover:bg-slate-50"}`}><Users size={14}/>{s}</button>)}</aside><div className="flex min-w-0 flex-col"><div className="border-b border-slate-200 px-5 py-4"><p className="font-semibold">Geral</p><p className="text-xs text-slate-500">{messages.length} mensagens · conversa de demonstração</p></div><div className="flex-1 space-y-5 bg-[#f8f9fb] p-5">{messages.map(m=><div key={m.id} className={`flex gap-2 ${m.author==="Você"?"justify-end":""}`}>{m.author!=="Você"&&<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold">{m.initials}</span>}<div className={`max-w-[80%] rounded-2xl border px-4 py-3 ${m.author==="Você"?"border-blue-700 bg-blue-700 text-white":"border-slate-200 bg-white"}`}><p className={`mb-1 text-[10px] ${m.author==="Você"?"text-blue-100":"text-slate-500"}`}>{m.author} · {m.time}</p><p className="text-sm leading-6">{m.text}</p></div></div>)}</div><form onSubmit={e=>{e.preventDefault();addMessage()}} className="flex gap-2 border-t border-slate-200 p-3"><input value={messageDraft} onChange={e=>setMessageDraft(e.target.value)} placeholder="Mensagem..." className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"/><button className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white"><Send size={17}/></button></form></div></div>}
        {active==="Mural e comunicados" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Mural e comunicados</h2><form onSubmit={e=>{e.preventDefault();addAnnouncement()}} className="mt-4 flex gap-2"><input value={announcementDraft} onChange={e=>setAnnouncementDraft(e.target.value)} placeholder="Título do novo comunicado" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"/><button className="rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Publicar</button></form><div className="mt-5 grid gap-3 md:grid-cols-2">{announcements.map(a=><article key={a.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{a.title}</h3><button onClick={()=>setAnnouncements(old=>old.filter(x=>x.id!==a.id))} className="text-slate-400 hover:text-red-600"><X size={15}/></button></div><p className="mt-2 text-sm leading-6 text-slate-600">{a.body}</p><p className="mt-3 text-xs text-slate-400">Publicado agora · Ambiente de teste</p></article>)}</div></div>}
        {active==="Calendário" && <div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Calendário da equipe</h2><p className="mt-1 text-sm text-slate-500">Agenda demonstrativa · Outubro de 2026</p><div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="py-2 font-semibold text-slate-500">{d}</div>)}{Array.from({length:35},(_,i)=><div key={i} className={`flex min-h-12 items-center justify-center rounded-lg border text-sm ${[5,12,19,26].includes(i)?"border-blue-200 bg-blue-50 font-semibold text-blue-800":"border-slate-100 text-slate-600"}`}>{i<4?"":i-3<=31?i-3:""}</div>)}</div></div>}
        {active==="Aniversariantes" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Painel de aniversariantes</h2><p className="mt-1 text-sm text-slate-500">Dados fictícios para conhecer a organização do painel.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{n:"Ana Souza",d:"14 de outubro",i:"AS"},{n:"Rafael Martins",d:"22 de outubro",i:"RM"},{n:"Mariana Costa",d:"27 de outubro",i:"MC"}].map(p=><div key={p.n} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{p.i}</span><div><p className="text-sm font-semibold">{p.n}</p><p className="text-xs text-slate-500">{p.d}</p></div></div>)}</div></div>}
        {active==="Avaliações" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Avaliações e formulários</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">Pesquisa de satisfação interna</p><p className="mt-2 text-sm text-slate-500">8 respostas fictícias · Em andamento</p><div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 w-3/4 rounded-full bg-blue-600"/></div></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">Avaliação de rotina</p><p className="mt-2 text-sm text-slate-500">12 respostas fictícias · Concluída</p><div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 w-full rounded-full bg-emerald-500"/></div></div></div></div>}
        {active==="Banco de horas" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Banco de horas</h2><p className="mt-1 text-sm text-slate-500">Valores fictícios, sem integração com folha ou ponto.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{n:"Horas positivas",v:"+12h 30m"},{n:"Horas negativas",v:"-02h 15m"},{n:"Pessoas na amostra",v:"08"}].map(x=><div key={x.n} className="rounded-xl border border-slate-200 p-4"><p className="text-sm text-slate-500">{x.n}</p><p className="mt-2 text-2xl font-semibold">{x.v}</p></div>)}</div></div>}
        {active==="Indicadores" && <div className="grid gap-4 md:grid-cols-2">{[{n:"Tarefas concluídas",v:"78%",w:"78%"},{n:"Mensagens respondidas",v:"91%",w:"91%"},{n:"Comunicados lidos",v:"84%",w:"84%"},{n:"Avaliações concluídas",v:"67%",w:"67%"}].map(x=><div key={x.n} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{x.n}</p><p className="mt-2 text-3xl font-semibold">{x.v}</p><div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:x.w}}/></div></div>)}</div>}
        {active==="Equipe e setores" && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold">Equipe e setores</h2><p className="mt-1 text-sm text-slate-500">Perfis fictícios de demonstração</p></div><div className="divide-y divide-slate-100">{[{n:"Mariana Costa",r:"Admissão"},{n:"Rafael Martins",r:"Folha"},{n:"Ana Souza",r:"Mesa Operacional"},{n:"Você (demonstração)",r:"Administrador de teste"}].map(p=><div key={p.n} className="flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{p.n.split(" ").map(s=>s[0]).slice(0,2).join("")}</span><p className="flex-1 text-sm font-medium">{p.n}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{p.r}</span></div>)}</div></div>}
        {active==="Documentos" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Controles e documentos</h2><div className="mt-4 space-y-3">{["Manual de procedimentos.pdf","Checklist de integração.xlsx","Comunicado interno.docx"].map((f,i)=><div key={f} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><FileText className="text-blue-700" size={19}/><span className="flex-1 text-sm">{f}</span><span className="text-xs text-slate-400">Exemplo</span></div>)}</div></div>}
        {active==="Configurações" && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Configurações do ambiente de teste</h2><div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">Esta demonstração usa apenas o armazenamento local deste navegador. Não há conexão com contas, empresas ou dados de produção.</div><button onClick={()=>{setTasks(DEFAULT_TASKS);setMessages(DEFAULT_MESSAGES);setAnnouncements([{id:"a1",title:"Reunião semanal de operações",body:"Quinta-feira, às 10h. Sala de reuniões."},{id:"a2",title:"Atualização de procedimentos",body:"Consulte os procedimentos atualizados antes de iniciar as atividades."}]);}} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">Restaurar dados de exemplo</button></div>}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-4 text-xs text-slate-400"><span>NUVEXA · TESTE ISOLADO</span><span>Todos os dados exibidos são fictícios.</span></footer>
      </main>
    </div>
  </div>;
}
