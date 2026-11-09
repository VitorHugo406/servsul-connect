// Public self-service subscription (/assinar): plan -> company -> administrator -> review -> Mercado
// Pago checkout. /assinar/retorno polls the signup until the payment is confirmed by the server and the
// company is created, then shows the login link. Nothing is created before the payment is confirmed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, Lock, ShieldCheck, Upload, X, CreditCard, Building2, UserRound, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordChecklist } from '@/components/common/PasswordChecklist';
import { passwordError } from '@/lib/passwordPolicy';
import { optimizeImageFile } from '@/lib/imageOptimization';
import { EwwonLogo } from '@/components/common/EwwonLoader';
import { cn } from '@/lib/utils';

const FN = 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/billing';
const PENDING_KEY = 'ewvon:signup:pending';
type Plan = { id: string; name: string; description: string; price_cents: number; annual_price_cents: number | null; max_users: number; max_sectors: number; storage_gb: number; features: string[] };
const FEATURE_LABEL: Record<string, string> = {
  chat: 'Chat por setores e conversas', announcements: 'Avisos', important_notices: 'Comunicados importantes', tasks: 'Quadros de tarefas', notes: 'Anotações',
  birthdays: 'Aniversariantes', calendar: 'Calendário e reuniões', meeting_rooms: 'Salas de reunião', shortcuts: 'Atalhos do sistema', metrics_dashboard: 'Painel de métricas',
  evaluations: 'Avaliações', people_management: 'Gestão de pessoas', war_room: 'War Room', dashboard_3d: 'Dashboard 3D',
};
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
type Cycle = 'monthly' | 'annual' | 'once';
const CYCLE_OPTIONS: { id: Cycle; label: string; hint: string }[] = [
  { id: 'monthly', label: 'Mensal', hint: 'Renova sozinho todo mês · cartão de crédito' },
  { id: 'annual', label: 'Anual', hint: 'Renova sozinho todo ano · cartão de crédito' },
  { id: 'once', label: 'Mensal avulso', hint: 'Paga uma vez, vale 1 mês · Pix, boleto ou cartão' },
];
const annualOf = (p: Plan) => p.annual_price_cents ?? Math.round(p.price_cents * 12 * 0.92);
const priceOf = (p: Plan, c: Cycle) => (c === 'annual' ? annualOf(p) : p.price_cents);
const periodOf = (c: Cycle) => (c === 'annual' ? '/ano' : c === 'once' ? ' por 1 mês' : '/mês');
const call = async (route: string, body: unknown) => {
  const r = await fetch(`${FN}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || 'Não foi possível concluir. Tente novamente.');
  return data;
};
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

const STEPS = [
  { id: 'plan', label: 'Plano', icon: CreditCard },
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'admin', label: 'Administrador', icon: UserRound },
  { id: 'review', label: 'Revisão', icon: ClipboardCheck },
] as const;

// Public subscriptions open on 01/01/2027 (00:00 in São Paulo). Until then the page only works through
// the hidden test link (?acesso=...), remembered for the browser tab so the checkout flow keeps working.
const LAUNCH_AT = Date.parse('2027-01-01T03:00:00Z');
const PRELAUNCH_KEY = 'xwx7g4hx14';
function prelaunchAccess(): boolean {
  if (Date.now() >= LAUNCH_AT) return true;
  try {
    if (new URLSearchParams(window.location.search).get('acesso') === PRELAUNCH_KEY) sessionStorage.setItem('ewvon:prelaunch', '1');
    return sessionStorage.getItem('ewvon:prelaunch') === '1';
  } catch { return new URLSearchParams(window.location.search).get('acesso') === PRELAUNCH_KEY; }
}

export default function Subscribe() {
  const location = useLocation();
  if (location.pathname.startsWith('/assinar/retorno')) return <Shell><ReturnView /></Shell>;
  if (!prelaunchAccess()) return <Shell><ComingSoon /></Shell>;
  return <Shell><Wizard /></Shell>;
}

function ComingSoon() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Assinaturas a partir de 01/01/2027</h1>
      <p className="mt-3 text-sm text-muted-foreground">Os planos do ewvon ficam disponíveis para assinatura a partir de 1º de janeiro de 2027. Até lá, você pode participar da fase de testes pela página inicial.</p>
      <a href="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background">Voltar ao início</a>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 text-foreground" aria-label="ewvon"><EwwonLogo size={30} animate={false} /><span className="text-lg font-semibold">ewvon</span></a>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" />Ambiente seguro · pagamento pelo Mercado Pago</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

function Wizard() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState(() => new URLSearchParams(window.location.search).get('plano') || '');
  const [cycle, setCycle] = useState<Cycle>(() => { const c = new URLSearchParams(window.location.search).get('ciclo'); return c === 'anual' ? 'annual' : c === 'avulso' ? 'once' : 'monthly'; });
  const [company, setCompany] = useState({ name: '', primary: '#111827', secondary: '#6366f1' });
  const [logo, setLogo] = useState<{ data: string; type: string; preview: string } | null>(null);
  const [adm, setAdm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The internal test plan only shows up through its own link (?plano=teste).
    const wantsTest = new URLSearchParams(window.location.search).get('plano') === 'teste';
    call('plans', {}).then((d) => { setPlans((d.plans || []).filter((p: Plan) => p.id !== 'teste' || wantsTest)); setReady(!!d.payments_ready); if (!planId && d.plans?.[1]) setPlanId(d.plans[1].id); }).catch((e) => setLoadErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const plan = plans.find((p) => p.id === planId);

  const stepError = useMemo(() => {
    if (step === 0) return plan ? '' : 'Escolha um plano.';
    if (step === 1) {
      if (company.name.trim().length < 2) return 'Informe o nome da empresa.';
      if (!/^#[0-9a-f]{6}$/i.test(company.primary) || !/^#[0-9a-f]{6}$/i.test(company.secondary)) return 'Use cores no formato #RRGGBB.';
      return '';
    }
    if (step === 2) {
      if (adm.name.trim().length < 3) return 'Informe o nome do administrador.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adm.email.trim())) return 'Informe um e-mail válido.';
      const pe = passwordError(adm.password); if (pe) return pe;
      if (adm.password !== adm.confirm) return 'As senhas não coincidem.';
      return '';
    }
    return accepted ? '' : 'Confirme que leu e concorda com a cobrança mensal.';
  }, [step, plan, company, adm, accepted]);

  const pickLogo = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setErr('Use uma imagem PNG, JPG ou WEBP.'); return; }
    const opt = await optimizeImageFile(file, 512);
    if (opt.size > 1024 * 1024) { setErr('A logo deve ter no máximo 1MB.'); return; }
    const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(opt); });
    setLogo({ data, type: opt.type || 'image/png', preview: data }); setErr('');
  };

  const next = () => { if (stepError) { setErr(stepError); return; } setErr(''); setStep((s) => Math.min(3, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const submit = async () => {
    if (stepError) { setErr(stepError); return; }
    setBusy(true); setErr('');
    try {
      const d = await call('signup', {
        plan_id: planId,
        billing_cycle: cycle,
        company: { name: company.name.trim(), primary_color: company.primary, secondary_color: company.secondary, logo: logo ? { data: logo.data, type: logo.type } : null },
        admin: { name: adm.name.trim(), email: adm.email.trim(), password: adm.password },
      });
      safeSet(PENDING_KEY, JSON.stringify({ id: d.id, token: d.token }));
      setAdm((a) => ({ ...a, password: '', confirm: '' }));
      window.location.assign(d.checkout_url);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  if (loadErr) return <p className="py-20 text-center text-sm text-muted-foreground">{loadErr}</p>;
  if (!plans.length) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-[10px] border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h1 className="text-[22px] font-semibold leading-7">Assinar o ewvon</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Preencha os dados da sua empresa. Ela é criada automaticamente assim que o pagamento for confirmado.</p>
          <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {STEPS.map((s, i) => (
              <li key={s.id} className={cn('flex items-center gap-2 text-sm', i === step ? 'font-medium text-foreground' : i < step ? 'text-foreground' : 'text-muted-foreground')}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full border text-xs', i < step ? 'border-foreground bg-foreground text-background' : i === step ? 'border-foreground' : 'border-border')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-5 px-6 py-6">
          {!ready ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">Os pagamentos estão sendo configurados. Você pode preencher os dados, mas o envio só funciona depois da configuração.</p> : null}

          {step === 0 ? (
            <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Forma de pagamento">
              {CYCLE_OPTIONS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={cycle === c.id} onClick={() => setCycle(c.id)} className={cn('rounded-lg border px-3 py-2.5 text-left transition-colors', cycle === c.id ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground/40')}>
                  <span className="flex items-center justify-between text-sm font-semibold">{c.label}{c.id === 'annual' ? <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', cycle === c.id ? 'bg-background/15' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>8% de desconto</span> : null}</span>
                  <span className={cn('mt-0.5 block text-[12px]', cycle === c.id ? 'text-background/75' : 'text-muted-foreground')}>{c.hint}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlanId(p.id)} className={cn('rounded-[10px] border p-4 text-left transition-colors', planId === p.id ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:border-foreground/40')}>
                  <div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span>{planId === p.id ? <Check className="h-4 w-4" /> : null}</div>
                  <p className="mt-2 text-xl font-semibold tabular-nums">{brl(priceOf(p, cycle))}<span className="text-sm font-normal text-muted-foreground">{periodOf(cycle)}</span></p>{cycle === 'annual' ? <p className="text-[12px] text-muted-foreground">equivale a {brl(Math.round(annualOf(p) / 12))}/mês</p> : null}
                  <p className="mt-1 text-[13px] text-muted-foreground">{p.description}</p>
                  <ul className="mt-3 space-y-1 text-[13px]">
                    <li>Até {p.max_users} usuários</li><li>{p.max_sectors} setores · {p.storage_gb} GB</li>
                  </ul>
                </button>
              ))}
            </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="cn">Nome da empresa</Label><Input id="cn" maxLength={80} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Ex.: Grupo Exemplo" /></div>
                <div className="space-y-1.5">
                  <Label>Logo <span className="font-normal text-muted-foreground">(opcional, PNG/JPG/WEBP até 1MB)</span></Label>
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">{logo ? <img src={logo.preview} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5 text-muted-foreground" />}</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-4 w-4" />{logo ? 'Trocar' : 'Enviar logo'}</Button>
                    {logo ? <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}><X className="mr-1 h-4 w-4" />Remover</Button> : null}
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
                  </div>
                </div>
                {(['primary', 'secondary'] as const).map((k) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{k === 'primary' ? 'Cor primária' : 'Cor secundária'}</Label>
                    <div className="flex items-center gap-2">
                      <input id={k} type="color" value={company[k]} onChange={(e) => setCompany({ ...company, [k]: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0.5" />
                      <Input value={company[k]} maxLength={7} onChange={(e) => setCompany({ ...company, [k]: e.target.value.trim() })} className="w-32 font-mono" />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-[13px] text-muted-foreground">Pré-visualização</p>
                <div className="overflow-hidden rounded-[10px] border border-border">
                  <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: company.primary }}>
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-white/15">{logo ? <img src={logo.preview} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-4 w-4" />}</div>
                    <span className="truncate font-semibold">{company.name || 'Sua empresa'}</span>
                  </div>
                  <div className="space-y-2 bg-background p-4">
                    <div className="h-2.5 w-2/3 rounded bg-muted" /><div className="h-2.5 w-1/2 rounded bg-muted" />
                    <span className="mt-2 inline-block rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: company.secondary }}>Botão de destaque</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid max-w-md gap-4">
              <p className="text-[13px] text-muted-foreground">Esta será a conta de administrador da empresa. Depois você cadastra os colaboradores pelo sistema.</p>
              <div className="space-y-1.5"><Label htmlFor="an">Nome completo</Label><Input id="an" maxLength={80} autoComplete="name" value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ae">E-mail de acesso</Label><Input id="ae" type="email" maxLength={160} autoComplete="email" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ap">Senha</Label><Input id="ap" type="password" maxLength={72} autoComplete="new-password" value={adm.password} onChange={(e) => setAdm({ ...adm, password: e.target.value })} /><PasswordChecklist value={adm.password} className="pt-1" /></div>
              <div className="space-y-1.5"><Label htmlFor="ac">Confirmar senha</Label><Input id="ac" type="password" maxLength={72} autoComplete="new-password" value={adm.confirm} onChange={(e) => setAdm({ ...adm, confirm: e.target.value })} /></div>
            </div>
          ) : null}

          {step === 3 && plan ? (
            <div className="space-y-4">
              <dl className="divide-y divide-border rounded-[10px] border border-border text-sm">
                {[['Plano', `${plan.name} · ${brl(priceOf(plan, cycle))}${periodOf(cycle)}`], ['Forma de pagamento', CYCLE_OPTIONS.find((c) => c.id === cycle)!.label], ['Empresa', company.name], ['Cores', `${company.primary} · ${company.secondary}`], ['Logo', logo ? 'Enviada' : 'Sem logo'], ['Administrador', `${adm.name} (${adm.email})`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                <span>{cycle === 'once' ? <>Concordo em pagar {brl(priceOf(plan, cycle))} uma única vez pelo Mercado Pago (Pix, boleto ou cartão), válido por 1 mês, sem renovação automática.</> : <>Concordo com a cobrança {cycle === 'annual' ? 'anual' : 'mensal'} de {brl(priceOf(plan, cycle))} no cartão de crédito pelo Mercado Pago, que pode ser cancelada a qualquer momento.</>} A empresa só é criada depois da confirmação do pagamento.</span>
              </label>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Os dados de pagamento são digitados no Mercado Pago e nunca passam pelo ewvon.</p>
            </div>
          ) : null}

          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => { setErr(''); setStep((s) => Math.max(0, s - 1)); }}><ChevronLeft className="mr-1 h-4 w-4" />Voltar</Button>
          {step < 3
            ? <Button type="button" onClick={next}>Continuar</Button>
            : <Button type="button" onClick={() => void submit()} disabled={busy || !ready}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Abrindo pagamento…</> : <><Lock className="mr-2 h-4 w-4" />Ir para o pagamento</>}</Button>}
        </div>
      </section>

      <aside className="h-fit rounded-[10px] border border-border bg-card p-5">
        <p className="text-[13px] text-muted-foreground">Resumo</p>
        {plan ? <>
          <p className="mt-1 text-lg font-semibold">Plano {plan.name}</p>
          <p className="text-2xl font-semibold tabular-nums">{brl(priceOf(plan, cycle))}<span className="text-sm font-normal text-muted-foreground">{periodOf(cycle)}</span></p>
          <p className="text-[12px] text-muted-foreground">{CYCLE_OPTIONS.find((c) => c.id === cycle)!.hint}</p>
          <ul className="mt-4 space-y-1.5 text-[13px]">{plan.features.filter((f) => FEATURE_LABEL[f]).map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-muted-foreground" />{FEATURE_LABEL[f]}</li>)}</ul>
        </> : null}
        <button type="button" onClick={() => navigate('/select-company')} className="mt-5 text-[13px] text-muted-foreground underline-offset-2 hover:underline">Já tenho uma conta</button>
      </aside>
    </div>
  );
}

function ReturnView() {
  const params = new URLSearchParams(window.location.search);
  const saved = (() => { try { return JSON.parse(safeGet(PENDING_KEY) || 'null'); } catch { return null; } })();
  const id = params.get('s') || saved?.id;
  const token = params.get('t') || saved?.token;
  const [state, setState] = useState<{ status?: string; company_name?: string; slug?: string | null; admin_email?: string; checkout_url?: string | null; error?: string }>({});
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!id || !token) return;
    let stop = false;
    const tick = async () => {
      try {
        const d = await call('status', { id, token });
        if (stop) return;
        setState(d); setTries((t) => t + 1);
        if (d.status === 'active') { safeSet(PENDING_KEY, null); return; }
        if (['expired', 'canceled'].includes(d.status)) return;
      } catch (e) { if (!stop) setState({ error: (e as Error).message }); }
      if (!stop) window.setTimeout(tick, 5000);
    };
    void tick();
    return () => { stop = true; };
  }, [id, token]);

  const box = (title: string, text: React.ReactNode, extra?: React.ReactNode, icon?: React.ReactNode) => (
    <div className="mx-auto max-w-lg rounded-[10px] border border-border bg-card p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">{icon}</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-2 text-sm text-muted-foreground">{text}</div>
      {extra ? <div className="mt-6">{extra}</div> : null}
    </div>
  );

  if (!id || !token) return box('Cadastro não encontrado', 'Abra o link que recebeu ao concluir o pagamento, neste mesmo navegador.', <Button asChild><a href="/assinar">Começar de novo</a></Button>, <X className="h-5 w-5" />);
  if (state.error) return box('Não foi possível consultar', state.error, null, <X className="h-5 w-5" />);
  if (state.status === 'active') return box('Empresa criada!', <>O pagamento foi confirmado e <b className="text-foreground">{state.company_name}</b> já está pronta. Entre com o e-mail <b className="text-foreground">{state.admin_email}</b> e a senha que você definiu.</>, <Button asChild><a href={`/auth?company=${encodeURIComponent(state.slug || '')}`}>Entrar no ewvon</a></Button>, <Check className="h-5 w-5" />);
  if (state.status === 'canceled') return box('Pagamento não aprovado', 'O Mercado Pago não aprovou o pagamento e a assinatura foi encerrada. Nenhuma empresa foi criada e nada foi cobrado. Tente de novo com outro cartão de crédito, de preferência um que você já use no Mercado Pago.', <Button asChild><a href="/assinar">Tentar novamente</a></Button>, <X className="h-5 w-5" />);
  if (state.status === 'expired') return box('Cadastro encerrado', 'O pagamento não foi concluído em 3 dias. Nenhuma cobrança foi feita. Você pode começar de novo.', <Button asChild><a href="/assinar">Assinar novamente</a></Button>, <X className="h-5 w-5" />);
  if (state.status === 'provisioning' || state.status === 'failed') return box('Pagamento confirmado', 'Estamos criando a sua empresa. Isso leva poucos instantes; esta página atualiza sozinha.', null, <Loader2 className="h-5 w-5 animate-spin" />);
  return box('Aguardando confirmação do pagamento', <>Assim que o Mercado Pago confirmar, a sua empresa é criada automaticamente. Esta página atualiza sozinha{tries > 24 ? '. Pagamentos podem levar alguns minutos para serem confirmados.' : '.'}</>,
    state.checkout_url && tries > 3 ? <Button variant="outline" asChild><a href={state.checkout_url}>Voltar ao pagamento</a></Button> : null, <Loader2 className="h-5 w-5 animate-spin" />);
}
