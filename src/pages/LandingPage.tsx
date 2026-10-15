import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, ShieldCheck, MessageSquare, LayoutDashboard, Users,
  CalendarDays, ClipboardCheck, Workflow, BarChart3, Clock3, Building2,
  Smartphone, PanelsTopLeft, FileText, Bell, Zap
} from "lucide-react";

const features = [
  { icon: MessageSquare, title: "Comunicação centralizada", text: "Conversas individuais, grupos e canais por setor em um só ambiente." },
  { icon: Bell, title: "Mural e comunicados", text: "Compartilhe avisos importantes e mantenha as equipes alinhadas." },
  { icon: Workflow, title: "Kanban e tarefas", text: "Organize demandas, acompanhe responsáveis e visualize o andamento." },
  { icon: CalendarDays, title: "Calendário da equipe", text: "Consulte eventos, datas importantes e aniversariantes." },
  { icon: ClipboardCheck, title: "Avaliações e formulários", text: "Centralize avaliações e acompanhe respostas em um fluxo organizado." },
  { icon: Clock3, title: "Banco de horas e jornada", text: "Apoie o acompanhamento de horas e rotinas operacionais." },
  { icon: BarChart3, title: "Indicadores e relatórios", text: "Reúna informações operacionais para facilitar a análise e a tomada de decisão." },
  { icon: Users, title: "Gestão por setores", text: "Estruture equipes, usuários e permissões conforme a organização." },
  { icon: PanelsTopLeft, title: "Painéis personalizados", text: "Tenha uma visão prática das atividades e informações relevantes." },
  { icon: FileText, title: "Controles e documentos", text: "Organize controles operacionais e informações de apoio em um só lugar." },
  { icon: Smartphone, title: "Acesso pelo celular", text: "Use a experiência responsiva e tenha o sistema à mão no dia a dia." },
  { icon: ShieldCheck, title: "Ambientes separados", text: "Empresas e departamentos têm seus próprios espaços e dados isolados." },
];

const plans = [
  { name: "Essencial", description: "Para equipes que querem organizar a rotina.", points: ["Comunicação e mural", "Organização de tarefas", "Calendário e avisos"], featured: false },
  { name: "Profissional", description: "Para operações que precisam de mais controle.", points: ["Recursos do Essencial", "Controles operacionais", "Relatórios e acompanhamento"], featured: true },
  { name: "Corporativo", description: "Para estruturas com vários setores e necessidades.", points: ["Organização por departamentos", "Permissões e gestão ampliada", "Avaliação de necessidades da empresa"], featured: false },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 28);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f9fc] text-[#101828]">
      <div className="h-[76px] md:h-[88px]">
        <header className={`fixed left-1/2 top-3 z-50 flex w-[calc(100%-1.5rem)] max-w-7xl -translate-x-1/2 items-center justify-between rounded-[1.35rem] border px-4 transition-all duration-500 ease-in-out md:top-4 md:px-7 ${scrolled
          ? "translate-y-0 scale-[0.96] border-white/25 bg-slate-100/15 py-2 shadow-[0_12px_40px_-18px_rgba(15,35,70,.25)] backdrop-blur-xl"
          : "translate-y-0 scale-100 border-transparent bg-transparent py-3 shadow-none backdrop-blur-0"}`}>
          <a href="#inicio" className="flex shrink-0 items-center gap-2.5" aria-label="Nuvexa início">
            <span className={`flex items-center justify-center rounded-2xl bg-[#172b4d] text-white shadow-lg shadow-blue-950/10 transition-all duration-500 ${scrolled ? "h-9 w-9" : "h-10 w-10"}`}><Zap size={20} /></span>
            <span className="flex items-center gap-2 font-bold tracking-tight">
              <span className={`transition-all duration-500 ${scrolled ? "text-lg" : "text-xl"}`}>nuvexa<span className="text-blue-600">.</span></span>
              <span className={`border-l border-slate-400/50 pl-2 font-sans text-[9px] font-medium uppercase tracking-[.18em] text-slate-500 ${scrolled ? "hidden" : "inline-block"}`}>Gestão de operações</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
            <a className="transition hover:text-blue-700" href="#recursos">Recursos</a>
            <a className="transition hover:text-blue-700" href="#como-funciona">Como funciona</a>
            <a className="transition hover:text-blue-700" href="#planos">Planos</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to="/select-company" className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/10 sm:inline-flex">Entrar</Link>
            <Link to="/select-company" className="inline-flex items-center gap-2 rounded-xl bg-[#172b4d] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-900">Testar grátis <ArrowRight size={16} /></Link>
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
        <div className="relative z-10 mx-auto w-full max-w-xl">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-blue-200/60 via-indigo-100/40 to-sky-100/70 blur-2xl" />
          <div className="relative rounded-[1.8rem] border border-white bg-white/90 p-3 shadow-[0_30px_100px_-35px_rgba(25,55,105,.35)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 pb-4 pt-2">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400"/><span className="h-2.5 w-2.5 rounded-full bg-amber-400"/><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/></div>
              <span className="text-[11px] font-semibold tracking-wide text-slate-400">NUVEXA WORKSPACE</span>
              <span className="h-7 w-7 rounded-full bg-blue-50" />
            </div>
            <div className="grid grid-cols-[68px_1fr] gap-3 p-2 sm:grid-cols-[84px_1fr] sm:p-4">
              <aside className="flex flex-col items-center gap-3 rounded-2xl bg-[#172b4d] py-4 text-white">
                <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/15"><Zap size={17}/></span>
                {[LayoutDashboard, MessageSquare, Users, CalendarDays, ClipboardCheck].map((Icon, i) => <span key={i} className={`flex h-9 w-9 items-center justify-center rounded-xl ${i===0 ? "bg-white text-blue-800" : "text-blue-100/80"}`}><Icon size={17}/></span>)}
              </aside>
              <div className="min-w-0 py-1">
                <div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-medium text-slate-400">VISÃO GERAL</p><h3 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Painel de operações</h3></div><span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Visão geral</span></div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                  {[["Tarefas abertas","24","+4 nesta semana"],["Mensagens","18","3 não lidas"],["Avaliações","92%","respostas registradas"],["Setores ativos","06","equipe conectada"]].map(([label,value,sub],i)=><div key={label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><p className="text-[10px] text-slate-500 sm:text-xs">{label}</p><p className="mt-1 text-xl font-bold tracking-tight text-slate-800">{value}</p><p className={`mt-1 text-[9px] sm:text-[10px] ${i===1?"text-amber-600":"text-emerald-600"}`}>{sub}</p></div>)}
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 p-3">
                  <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold text-slate-700">Demandas recentes</p><span className="text-[10px] text-blue-700">Ver tarefas</span></div>
                  {["Revisar solicitação interna","Atualizar comunicado da equipe","Conferir pendências do setor"].map((item,i)=><div key={item} className="flex items-center gap-2 border-t border-slate-50 py-2 first:border-0"><span className={`h-2 w-2 rounded-full ${i===0?"bg-amber-400":i===1?"bg-blue-500":"bg-emerald-500"}`}/><span className="truncate text-[10px] text-slate-600 sm:text-xs">{item}</span><span className="ml-auto rounded-md bg-slate-50 px-1.5 py-1 text-[9px] text-slate-500">{i===0?"Em andamento":i===1?"Novo":"Concluído"}</span></div>)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Ambiente organizado</span><span>Um espaço para cada equipe</span></div>
          </div>
          <div className="absolute -right-3 top-16 hidden rounded-2xl border border-white bg-white p-3 shadow-xl sm:block"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={16}/></span><div><p className="text-xs font-bold text-slate-800">Tudo conectado</p><p className="text-[10px] text-slate-500">Equipes e rotinas</p></div></div></div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 text-sm font-medium text-slate-500 md:justify-between md:px-8">
          <span className="text-xs font-bold uppercase tracking-[.16em] text-slate-400">Uma plataforma</span><span>Comunicação</span><span>Organização</span><span>Operação</span><span>Indicadores</span><span>Equipes</span>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Tudo conectado</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111d33] sm:text-4xl">As ferramentas da rotina, no mesmo ambiente.</h2><p className="mt-4 leading-7 text-slate-600">Menos troca entre sistemas e planilhas. Mais clareza sobre o que está acontecendo e quem precisa agir.</p></div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map(({icon:Icon,title,text})=><article key={title} className="group rounded-2xl border border-slate-200/80 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><Icon size={20}/></span><h3 className="mt-5 font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
      </section>

      <section id="como-funciona" className="bg-[#101f39] py-20 text-white md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-300">Comece com simplicidade</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Da sua empresa para uma rotina mais organizada.</h2><p className="mt-4 leading-7 text-slate-300">A Nuvexa foi pensada para acompanhar a estrutura da organização, de equipes menores a operações com vários departamentos.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{[{n:"01",title:"Encontre seu ambiente",text:"Informe o nome da empresa para localizar o espaço corporativo."},{n:"02",title:"Acesse sua equipe",text:"Entre com sua conta e visualize os recursos liberados para seu ambiente."},{n:"03",title:"Organize o trabalho",text:"Centralize conversas, demandas e controles da operação."}].map(s=><div key={s.n} className="rounded-2xl border border-white/10 bg-white/[.04] p-6"><span className="text-sm font-semibold text-blue-300">{s.n}</span><h3 className="mt-4 text-lg font-semibold">{s.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{s.text}</p></div>)}</div><div className="mt-8"><Link to="/select-company" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#101f39] transition hover:bg-blue-50">Acessar minha empresa <ArrowRight size={16}/></Link></div></div>
      </section>

      <section id="planos" className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Planos</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111d33] sm:text-4xl">Um formato que acompanha sua operação.</h2><p className="mt-4 leading-7 text-slate-600">Conheça as opções e escolha o conjunto de recursos adequado para sua empresa. Os valores e condições devem ser confirmados com a equipe comercial.</p></div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map(plan=><article key={plan.name} className={`relative flex flex-col rounded-3xl border p-7 ${plan.featured?"border-blue-600 bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-blue-600":"border-slate-200 bg-white"}`}>{plan.featured&&<span className="absolute -top-3 left-6 rounded-full bg-blue-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Mais recursos</span>}<h3 className="text-xl font-bold text-slate-900">{plan.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p><p className="mt-5 text-2xl font-semibold tracking-tight text-[#172b4d]">Consulte valores</p><p className="mt-1 text-xs text-slate-500">Condições conforme a necessidade</p><ul className="my-7 flex-1 space-y-3">{plan.points.map(point=><li key={point} className="flex gap-2 text-sm text-slate-600"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600"/>{point}</li>)}</ul><Link to="/select-company" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${plan.featured?"bg-blue-700 text-white hover:bg-blue-800":"border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Tenho interesse <ArrowRight size={16}/></Link></article>)}</div>
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">Os planos acima apresentam categorias de referência. Disponibilidade de módulos, valores, período de avaliação e condições comerciais precisam ser definidos antes da contratação.</p>
      </section>

      <section className="px-5 pb-20 md:px-8 md:pb-28"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-gradient-to-br from-blue-700 to-[#172b4d] p-8 text-white shadow-2xl shadow-blue-900/15 sm:p-12 md:flex-row md:items-center"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-200">Nuvexa · Gestão de operações</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sua equipe pode trabalhar com mais clareza.</h2><p className="mt-3 leading-7 text-blue-100">Centralize informações, conecte departamentos e dê mais visibilidade à rotina.</p></div><Link to="/select-company" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-800 transition hover:bg-blue-50">Começar agora <ArrowRight size={16}/></Link></div></section>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8"><span>© {new Date().getFullYear()} Nuvexa. Gestão de operações.</span><div className="flex gap-5"><a href="#recursos" className="hover:text-blue-700">Recursos</a><a href="#planos" className="hover:text-blue-700">Planos</a><Link to="/select-company" className="hover:text-blue-700">Entrar</Link></div></div></footer>
    </main>
  );
}
