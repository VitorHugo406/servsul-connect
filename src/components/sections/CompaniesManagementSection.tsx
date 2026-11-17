// Empresas (super admin only) — faithful port of the owner's design "Empresas - gestão" and
// "Empresas - assinaturas pelo site" (Tela_de_Avisos_8). CSS in src/styles/companies.css (prefix ce-, scope .ce-pg).
// The design's "Logs" tab / "Ver logs" were deliberately left out (each company's logs are confidential);
// "Atividade recente" shows only payment and subscription events.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getCompanyLogoPath } from '@/lib/companyLogo';
import { optimizeImageFile } from '@/lib/imageOptimization';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { CompanyPlanPanel } from '@/components/companies/CompanyPlanPanel';
import { Sel } from '@/components/ui/Sel';
import { appConfirm, appPrompt } from '@/lib/appDialog';
import { passwordError as passwordRuleError } from '@/lib/passwordPolicy';
import { PasswordChecklist } from '@/components/common/PasswordChecklist';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface CompanyStats {
  id: string; name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string;
  is_active: boolean; is_system: boolean; enabled_modules: string[];
  total_users: number; active_users: number; admins: number; supervisors: number; colaboradores: number;
}
interface CompanyUser { profile_id: string; user_id: string; name: string; display_name: string | null; email: string; autonomy_level: string; is_active: boolean; roles: string[] }
interface Sub { company_id: string; plan_id: string | null; status: string; current_period_end: string | null; trial_ends_at: string | null; billing_cycle: string | null }
interface PlanRow { id: string; name: string; price_cents: number; annual_price_cents: number | null; features: string[] }
interface Payment { id: string; company_id: string; kind: string; description: string | null; amount_cents: number; paid_at: string; status: string; provider_payment_id: string | null; receipt_number: number | null }
interface Receipt { id: string; company_id: string; kind: string; description: string | null; amount_cents: number; paid_at: string; status: string; provider_payment_id: string | null; receipt_number: number | null; receipt_sent_at: string | null }
interface Signup { id: string; status: string; plan_id: string; amount_cents: number; company_name: string; admin_email: string; admin_name: string | null; error: string | null; attempts: number; created_at: string; activated_at: string | null; company_id: string | null; billing_cycle: string | null; paid_at: string | null }

/** Modules the super admin can switch on/off; `feature` is the plan feature that unlocks it ("Fora do plano" otherwise). */
const MODULES: { id: string; label: string; feature?: string }[] = [
  { id: 'chat', label: 'Chat', feature: 'chat' },
  { id: 'announcements', label: 'Avisos', feature: 'announcements' },
  { id: 'tasks', label: 'Quadros de tarefas', feature: 'tasks' },
  { id: 'notes', label: 'Anotações', feature: 'notes' },
  { id: 'war_room', label: 'War Room', feature: 'war_room' },
  { id: 'calendar', label: 'Calendário', feature: 'calendar' },
  { id: 'evaluations', label: 'Avaliações', feature: 'evaluations' },
  { id: 'birthdays', label: 'Aniversariantes', feature: 'birthdays' },
  { id: 'teams', label: 'Equipes' },
  { id: 'my_dashboard', label: 'Meu Painel' },
  { id: 'orbs', label: 'Orbs (atalho externo)' },
];
const SUB_LABEL: Record<string, [string, string]> = {
  pending: ['Aguardando', 'ce-c-e'], trialing: ['Em teste', 'ce-c-i'], active: ['Ativa', 'ce-c-a'], past_due: ['Pagamento atrasado', 'ce-c-r'],
  canceled: ['Cancelada', 'ce-c-c'], free: ['Gratuita', 'ce-c-i'], exempt: ['Isenta', 'ce-c-s'],
};
const SIGNUP_LABEL: Record<string, [string, string]> = {
  pending_payment: ['Aguardando pagamento', 'ce-c-e'], provisioning: ['Criando empresa', 'ce-c-i'], active: ['Ativa', 'ce-c-a'],
  failed: ['Com erro', 'ce-c-r'], expired: ['Expirada sem pagamento', 'ce-c-e'], canceled: ['Cancelada', 'ce-c-c'],
};
const PAY_LABEL: Record<string, string> = { approved: 'Pagamento confirmado', paid: 'Pagamento confirmado', confirmed: 'Pagamento confirmado', refunded: 'Pagamento estornado', charged_back: 'Contestação de pagamento', pending: 'Pagamento pendente', rejected: 'Pagamento recusado' };
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dShort = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dLong = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dDay = (s: string) => new Date(s).toLocaleDateString('pt-BR');
const recNo = (n: number | null) => (n ? 'REC-' + String(n).padStart(6, '0') : '');
const initial = (s: string) => (s.trim()[0] || '?').toUpperCase();
/** Light background -> dark text, dark background -> white text. */
const ink = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff';
  const n = parseInt(m[1], 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? '#1C2430' : '#fff';
};
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;

async function fnError(error: unknown, data: unknown, fallback: string) {
  let msg = (data as { error?: string })?.error || (error as Error)?.message || fallback;
  if (error instanceof FunctionsHttpError) { try { const b = await error.context.json(); msg = b?.error || msg; } catch { /* keep */ } }
  return msg;
}

function Switch({ on, onClick, label, disabled }: { on: boolean; onClick?: () => void; label: string; disabled?: boolean }) {
  return <button type="button" className={'ce-sw' + (on ? ' ce-on' : '')} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}><i /></button>;
}

export function CompaniesManagementSection() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.some((r: { role: string }) => (r.role as string) === 'super_admin');

  const [tab, setTab] = useState<'emp' | 'ass' | 'rec'>('emp');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [recQ, setRecQ] = useState('');
  const [recPer, setRecPer] = useState<'all' | 'month' | '90' | 'unsent'>('all');
  const [companies, setCompanies] = useState<CompanyStats[]>([]);
  const [subs, setSubs] = useState<Record<string, Sub>>({});
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [created, setCreated] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<'all' | 'on' | 'off'>('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyStats | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // dialogs
  const [openNew, setOpenNew] = useState(false);
  const [nName, setNName] = useState(''); const [nSlug, setNSlug] = useState('');
  const [nPrimary, setNPrimary] = useState('#2E5AAC'); const [nSecondary, setNSecondary] = useState('#FF6B00');
  const [trialOn, setTrialOn] = useState(false); const [trialUntil, setTrialUntil] = useState(''); const [trialPlan, setTrialPlan] = useState('empresarial');
  const [creating, setCreating] = useState(false);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [aName, setAName] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPass, setAPass] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [openPlan, setOpenPlan] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false); const [deleteName, setDeleteName] = useState(''); const [deleting, setDeleting] = useState(false);
  const [sigFlt, setSigFlt] = useState<'all' | 'active' | 'canceled' | 'expired' | 'error'>('all');
  const [sigDetail, setSigDetail] = useState<Signup | null>(null);

  const load = useCallback(async () => {
    const [c, s, p, g, cr, rc] = await Promise.all([
      db.rpc('list_companies_with_stats'),
      db.from('company_subscriptions').select('company_id,plan_id,status,current_period_end,trial_ends_at,billing_cycle'),
      db.from('subscription_plans').select('id,name,price_cents,annual_price_cents,features'),
      db.from('company_signups').select('id,status,plan_id,amount_cents,company_name,admin_email,admin_name,error,attempts,created_at,activated_at,company_id,billing_cycle,paid_at').order('created_at', { ascending: false }).limit(200),
      db.from('companies').select('id,created_at'),
      db.from('company_payments').select('id,company_id,kind,description,amount_cents,paid_at,status,provider_payment_id,receipt_number,receipt_sent_at').not('receipt_number', 'is', null).order('receipt_number', { ascending: false }).limit(1000),
    ]);
    if (c.error) toast.error('Não foi possível carregar as empresas.');
    const list = ((c.data || []) as CompanyStats[]).map((x) => ({ ...x, enabled_modules: x.enabled_modules ?? [] }));
    setCompanies(list);
    setSubs(Object.fromEntries(((s.data || []) as Sub[]).map((x) => [x.company_id, x])));
    setPlans((p.data || []) as PlanRow[]);
    setSignups((g.data || []) as Signup[]);
    setReceipts((rc.data || []) as Receipt[]);
    setCreated(Object.fromEntries(((cr.data || []) as { id: string; created_at: string }[]).map((x) => [x.id, x.created_at])));
    setLoading(false);
    return list;
  }, []);
  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin, load]);

  const sel = useMemo(() => companies.find((c) => c.id === selId) || null, [companies, selId]);
  useEffect(() => { if (!selId && companies.length) setSelId((companies.find((c) => !c.is_system) || companies[0]).id); }, [companies, selId]);
  useEffect(() => { setForm(sel ? { ...sel, enabled_modules: [...sel.enabled_modules] } : null); }, [sel]);
  const loadDetail = useCallback(async (id: string) => {
    const [u, pay] = await Promise.all([
      db.rpc('list_company_users', { _company_id: id }),
      db.from('company_payments').select('id,company_id,kind,description,amount_cents,paid_at,status,provider_payment_id,receipt_number').eq('company_id', id).order('paid_at', { ascending: false }).limit(20),
    ]);
    setUsers((u.data || []) as CompanyUser[]); setPayments((pay.data || []) as Payment[]);
  }, []);
  useEffect(() => { setUsers([]); setPayments([]); if (selId) void loadDetail(selId); }, [selId, loadDetail]);

  if (!isSuperAdmin) {
    return <div className="p-8 max-w-xl mx-auto text-center space-y-3"><ShieldAlert className="w-10 h-10 mx-auto text-destructive" /><p className="text-lg font-semibold">Acesso restrito</p><p className="text-sm text-muted-foreground">Esta área é exclusiva do super-administrador do sistema.</p></div>;
  }

  const shown = companies.filter((c) => (flt === 'all' || (flt === 'on' ? c.is_active : !c.is_active)) && (!q.trim() || (c.name + ' ' + c.slug).toLowerCase().includes(q.trim().toLowerCase())));
  const activeSubs = Object.values(subs).filter((s) => s.status === 'active').length;
  const sub = sel ? subs[sel.id] : undefined;
  const plan = sub?.plan_id ? plans.find((p) => p.id === sub.plan_id) : undefined;
  const admins = users.filter((u) => u.roles.includes('admin'));
  const dirty = !!(form && sel) && (form.name !== sel.name || form.primary_color !== sel.primary_color || form.secondary_color !== sel.secondary_color || form.logo_url !== sel.logo_url || form.enabled_modules.slice().sort().join() !== sel.enabled_modules.slice().sort().join());
  const set = (patch: Partial<CompanyStats>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error('Informe o nome da empresa.'); return; }
    setSaving(true);
    const { error } = await db.from('companies').update({ name: form.name.trim(), primary_color: form.primary_color, secondary_color: form.secondary_color, logo_url: form.logo_url, enabled_modules: form.enabled_modules }).eq('id', form.id);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar a empresa.'); return; }
    toast.success('Empresa atualizada'); void load();
  };
  const toggleActive = async () => {
    if (!sel || sel.is_system) return;
    if (sel.is_active && !(await appConfirm({ title: `Desativar ${sel.name}?`, message: 'Os usuários desta empresa deixam de acessar o sistema até você ativar de novo. Nenhum dado é apagado.', confirmText: 'Desativar', danger: true }))) return;
    const { error } = await db.from('companies').update({ is_active: !sel.is_active }).eq('id', sel.id);
    if (error) toast.error('Não foi possível mudar a situação da empresa.'); else { toast.success(sel.is_active ? 'Empresa desativada' : 'Empresa ativada'); void load(); }
  };
  const uploadLogo = async (file: File) => {
    if (!form) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 10 MB.'); return; }
    const opt = await optimizeImageFile(file, 1024);
    if (opt.size > 1024 * 1024) { toast.error('A logo deve ter no máximo 1 MB depois de otimizada.'); return; }
    const path = getCompanyLogoPath(form.slug, opt);
    const { error } = await supabase.storage.from('company-logos').upload(path, opt, { upsert: true, contentType: opt.type || 'image/png', cacheControl: '3600' });
    if (error) { toast.error('Não foi possível enviar a logo.'); return; }
    set({ logo_url: path }); toast.success('Logo enviada. Clique em Salvar alterações para aplicar.');
  };
  const removeAdmin = async (u: CompanyUser) => {
    if (!sel) return;
    if (admins.length <= 1) { toast.error('A empresa precisa ter pelo menos um administrador.'); return; }
    if (!(await appConfirm({ title: `Remover ${u.display_name || u.name} dos administradores?`, message: 'A pessoa continua na empresa como colaborador, só perde o acesso de administrador.', confirmText: 'Remover', danger: true }))) return;
    setBusy('adm:' + u.user_id);
    const { error } = await db.from('user_roles').delete().eq('user_id', u.user_id).eq('role', 'admin');
    if (!error && !u.roles.includes('colaborador')) await db.from('user_roles').insert({ user_id: u.user_id, role: 'colaborador' });
    setBusy(null);
    if (error) { toast.error('Não foi possível remover o administrador.'); return; }
    toast.success('Administrador removido'); void loadDetail(sel.id); void load();
  };
  const downloadReceipt = async (p: Payment | Receipt) => {
    setBusy('rec:' + p.id);
    try {
      const { data, error } = await supabase.functions.invoke('receipt', { body: { download: true, payment_id: p.id } });
      const b64 = (data as { base64?: string })?.base64;
      if (error || !b64) { toast.error(await fnError(error, data, 'Não foi possível gerar o recibo agora.')); return; }
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = (data as { filename?: string }).filename || 'recibo.pdf'; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { setBusy(null); }
  };
  const resendReceipt = async (p: Receipt) => {
    const sg = signups.find((x) => x.company_id === p.company_id);
    const to = await appPrompt({ title: `Reenviar ${recNo(p.receipt_number)}`, message: 'O recibo em PDF vai por e-mail. Deixe o e-mail do administrador da empresa ou digite outro.', label: 'E-mail de destino', defaultValue: sg?.admin_email || '', placeholder: 'nome@empresa.com', confirmText: 'Reenviar', validate: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Digite um e-mail válido.') });
    if (to === null) return;
    setBusy('snd:' + p.id);
    const { data, error } = await supabase.functions.invoke('receipt', { body: { resend: true, payment_id: p.id, to: to.trim() } });
    setBusy(null);
    if (error || !(data as { ok?: boolean })?.ok) { toast.error(await fnError(error, data, 'Não foi possível reenviar o recibo.')); return; }
    toast.success(`Recibo ${recNo(p.receipt_number)} reenviado`); void load();
  };
  const exportReceipts = (rows: Receipt[]) => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const nm = (id: string) => companies.find((c) => c.id === id)?.name || '';
    const lines = [['Recibo', 'Empresa', 'Descrição', 'Data', 'Valor', 'Forma', 'ID do pagamento', 'Envio'], ...rows.map((r) => [recNo(r.receipt_number), nm(r.company_id), r.description || '', dLong(r.paid_at), (r.amount_cents / 100).toFixed(2).replace('.', ','), 'Mercado Pago', r.provider_payment_id || '', r.receipt_sent_at ? 'Enviado ' + dLong(r.receipt_sent_at) : 'Não enviado'])];
    const blob = new Blob(['\ufeff' + lines.map((l) => l.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'recibos-ewvon.csv'; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const reconcile = async () => {
    setBusy('rec-all');
    const { error } = await supabase.functions.invoke('billing/reconcile', { body: {} });
    setBusy(null);
    if (error) { toast.error('Não foi possível conferir os pagamentos agora.'); return; }
    toast.success('Pagamentos conferidos com o Mercado Pago.'); void load();
  };
  const handleCreate = async () => {
    if (!nName.trim() || !nSlug.trim()) { toast.error('Nome e identificador são obrigatórios.'); return; }
    if (trialOn && (!trialUntil || new Date(trialUntil + 'T23:59:59').getTime() <= Date.now())) { toast.error('Informe uma data futura para o fim da avaliação.'); return; }
    setCreating(true);
    const { data: c, error } = await db.from('companies').insert({ name: nName.trim(), slug: nSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'), primary_color: nPrimary, secondary_color: nSecondary, is_active: true, is_system: false }).select('id').single();
    if (!error && trialOn && c?.id) {
      const { error: e2 } = await db.from('company_subscriptions').update({ status: 'trialing', plan_id: trialPlan, trial_ends_at: new Date(trialUntil + 'T23:59:59').toISOString(), notes: 'Período de avaliação até ' + new Date(trialUntil + 'T12:00:00').toLocaleDateString('pt-BR') }).eq('company_id', c.id);
      if (e2) toast.error('Empresa criada, mas não foi possível definir a avaliação.');
    }
    setCreating(false);
    if (error) { toast.error('Não foi possível criar a empresa (o identificador pode já estar em uso).'); return; }
    toast.success('Empresa criada');
    setNName(''); setNSlug(''); setNPrimary('#2E5AAC'); setNSecondary('#FF6B00'); setTrialOn(false); setTrialUntil(''); setTrialPlan('empresarial'); setOpenNew(false);
    await load(); if (c?.id) setSelId(c.id);
  };
  const handleCreateAdmin = async () => {
    if (!sel) return;
    if (!aName.trim() || !aEmail.trim()) { toast.error('Preencha nome e e-mail do administrador.'); return; }
    { const pe = passwordRuleError(aPass); if (pe) { toast.error(pe); return; } }
    setCreatingAdmin(true);
    const { data, error } = await supabase.functions.invoke('create-company-admin', { body: { company_id: sel.id, email: aEmail.trim().toLowerCase(), password: aPass, name: aName.trim() } });
    setCreatingAdmin(false);
    if (error || (data as { error?: string })?.error) { toast.error(await fnError(error, data, 'Não foi possível criar o administrador.')); return; }
    toast.success('Administrador criado'); setAName(''); setAEmail(''); setAPass(''); setOpenAdmin(false);
    void loadDetail(sel.id); void load();
  };

  // "Atividade recente": only payment / subscription events (no logs).
  const events = useMemo(() => {
    if (!sel) return [] as { t: string; title: string; sub: string }[];
    const ev: { t: string; title: string; sub: string }[] = [];
    for (const p of payments) ev.push({ t: p.paid_at, title: PAY_LABEL[p.status] || 'Pagamento', sub: ['Mercado Pago', brl(p.amount_cents), p.receipt_number ? 'Recibo ' + recNo(p.receipt_number) : p.description].filter(Boolean).join(' · ') });
    for (const g of signups.filter((x) => x.company_id === sel.id)) ev.push({ t: g.created_at, title: 'Assinatura criada pelo site', sub: `Plano ${g.plan_id} · ${brl(g.amount_cents)}${g.billing_cycle === 'annual' ? '/ano' : '/mês'}` });
    if (created[sel.id]) ev.push({ t: created[sel.id], title: 'Empresa criada', sub: 'Sistema · identificador ' + sel.slug });
    return ev.sort((a, b) => b.t.localeCompare(a.t)).slice(0, 6);
  }, [sel, payments, signups, created]);

  const lastPay = payments.find((p) => ['approved', 'paid', 'confirmed'].includes(p.status)) || payments[0];
  const lastRec = payments.find((p) => p.receipt_number);
  const cycle = sub?.billing_cycle === 'annual' ? 'ano' : 'mês';
  const planPrice = plan ? (sub?.billing_cycle === 'annual' && plan.annual_price_cents ? plan.annual_price_cents : plan.price_cents) : 0;

  // signups tab
  const sigCount = {
    all: signups.length, active: signups.filter((s) => s.status === 'active').length, canceled: signups.filter((s) => s.status === 'canceled').length,
    expired: signups.filter((s) => s.status === 'expired').length, error: signups.filter((s) => s.status === 'failed' || (!!s.error && s.status !== 'active' && s.status !== 'canceled' && s.status !== 'expired')).length,
  };
  const monthly = signups.filter((s) => s.status === 'active').reduce((t, s) => t + (s.billing_cycle === 'annual' ? Math.round(s.amount_cents / 12) : s.amount_cents), 0);
  const sigShown = signups.filter((s) => sigFlt === 'all' || (sigFlt === 'error' ? (s.status === 'failed' || (!!s.error && !['active', 'canceled', 'expired'].includes(s.status))) : s.status === sigFlt));
  const openCompany = (id: string) => { setSelId(id); setTab('emp'); };
  const compName = (id: string) => companies.find((c) => c.id === id)?.name || 'Empresa excluída';
  const nowD = new Date(); const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1).getTime();
  const PAID = ['approved', 'paid', 'confirmed'];
  const recShown = receipts.filter((r) => {
    const t = new Date(r.paid_at).getTime();
    if (recPer === 'month' && t < monthStart) return false;
    if (recPer === '90' && t < Date.now() - 90 * 864e5) return false;
    if (recPer === 'unsent' && r.receipt_sent_at) return false;
    const q2 = recQ.trim().toLowerCase();
    return !q2 || [recNo(r.receipt_number), compName(r.company_id), r.description || '', r.provider_payment_id || ''].join(' ').toLowerCase().includes(q2);
  });

  return (
    <div className="dk-pg ce-pg">
      <div className="ce-top">
        <div className="ce-tb">
          <button type="button" className={tab === 'emp' ? 'ce-on' : ''} onClick={() => setTab('emp')}>Empresas <em>{companies.length}</em></button>
          <button type="button" className={tab === 'ass' ? 'ce-on' : ''} onClick={() => setTab('ass')}>Assinaturas pelo site <em>{signups.length}</em></button>
          <button type="button" className={tab === 'rec' ? 'ce-on' : ''} onClick={() => setTab('rec')}>Recibos <em>{receipts.length}</em></button>
        </div>
        <div className="ce-rt">
          {tab === 'emp'
            ? <button type="button" className="ce-btn ce-pri" onClick={() => setOpenNew(true)}>+ Nova empresa</button>
            : tab === 'rec' ? <button type="button" className="ce-btn" onClick={() => exportReceipts(recShown)} disabled={!recShown.length}><Download className="h-4 w-4" />Exportar CSV</button>
            : <button type="button" className="ce-btn" onClick={() => void reconcile()} disabled={busy === 'rec-all'}><RefreshCw className={'h-4 w-4' + (busy === 'rec-all' ? ' animate-spin' : '')} />Conferir agora</button>}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : tab === 'rec' ? (
        <>
          <div className="ce-panel ce-kp">
            <div className="ce-k"><span>Recibos emitidos</span><b>{receipts.length}</b></div>
            <div className="ce-k"><span>Total recebido</span><b>{brl(receipts.filter((r) => PAID.includes(r.status)).reduce((t, r) => t + r.amount_cents, 0))}</b></div>
            <div className="ce-k"><span>Neste mês</span><b>{brl(receipts.filter((r) => PAID.includes(r.status) && new Date(r.paid_at).getTime() >= monthStart).reduce((t, r) => t + r.amount_cents, 0))}</b></div>
            <div className="ce-k"><span>Não enviados</span><b>{receipts.filter((r) => !r.receipt_sent_at).length}</b></div>
          </div>
          <div className="ce-panel">
            <div className="ce-sh">
              <div><b>Recibos</b><p>Todos os recibos emitidos pelo ewvon. Baixe o PDF ou reenvie por e-mail quando precisar.</p></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="ce-srch" placeholder="Buscar recibo, empresa ou ID…" value={recQ} onChange={(e) => setRecQ(e.target.value)} aria-label="Buscar recibo" />
                <div className="ce-fl">
                  {([['all', 'Todos'], ['month', 'Este mês'], ['90', '90 dias'], ['unsent', 'Não enviados']] as const).map(([k, l]) => <button key={k} type="button" className={recPer === k ? 'ce-on' : ''} onClick={() => setRecPer(k)}>{l}</button>)}
                </div>
              </div>
            </div>
            {!recShown.length ? <div className="ce-empty">{receipts.length ? 'Nenhum recibo neste filtro.' : 'Nenhum recibo emitido ainda.'}</div> : (
              <div className="ce-tw">
                <table>
                  <thead><tr><th>Recibo</th><th>Empresa</th><th>Data e hora</th><th>Valor</th><th>Pagamento</th><th>Envio por e-mail</th><th /></tr></thead>
                  <tbody>
                    {recShown.map((r) => (
                      <tr key={r.id}>
                        <td><span className="ce-mono">{recNo(r.receipt_number)}</span></td>
                        <td><div className="ce-tt">{compName(r.company_id)}</div><div className="ce-su">{r.description || 'Pagamento'}</div></td>
                        <td>{dLong(r.paid_at)}</td>
                        <td><b style={{ fontWeight: 600 }}>{brl(r.amount_cents)}</b>{!PAID.includes(r.status) ? <div className="ce-er">{PAY_LABEL[r.status] || r.status}</div> : null}</td>
                        <td><div>Mercado Pago</div><div className="ce-su">{r.provider_payment_id ? 'ID ' + r.provider_payment_id : '—'}</div></td>
                        <td>{r.receipt_sent_at ? <span className="ce-chip ce-c-a">Enviado {dShort(r.receipt_sent_at)}</span> : <span className="ce-chip ce-c-e">Não enviado</span>}</td>
                        <td>
                          <div className="ce-acts2">
                            <button type="button" className="ce-lk" disabled={busy === 'rec:' + r.id} onClick={() => void downloadReceipt(r)} title="Baixar PDF">{busy === 'rec:' + r.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Download className="inline h-4 w-4" />} Baixar</button>
                            <button type="button" className="ce-lk" disabled={busy === 'snd:' + r.id} onClick={() => void resendReceipt(r)} title="Reenviar por e-mail">{busy === 'snd:' + r.id ? <Loader2 className="inline h-4 w-4 animate-spin" /> : <Send className="inline h-4 w-4" />} Reenviar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : tab === 'emp' ? (
        <>
          <div className="ce-panel ce-kp">
            <div className="ce-k"><span>Empresas ativas</span><b>{companies.filter((c) => c.is_active).length} <small>de {companies.length}</small></b></div>
            <div className="ce-k"><span>Usuários ativos</span><b>{companies.reduce((t, c) => t + (c.active_users || 0), 0)}</b></div>
            <div className="ce-k"><span>Administradores</span><b>{companies.reduce((t, c) => t + (c.admins || 0), 0)}</b></div>
            <div className="ce-k"><span>Assinaturas ativas</span><b>{activeSubs}</b></div>
          </div>
          <div className="ce-main">
            <aside className="ce-panel" aria-label="Empresas">
              <div className="ce-sh2"><input className="ce-in" type="text" placeholder="Buscar empresa..." aria-label="Buscar empresa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="ce-sh2" style={{ paddingTop: 0 }}>
                <div className="ce-fl">
                  {([['all', 'Todas'], ['on', 'Ativas'], ['off', 'Inativas']] as const).map(([k, l]) => <button key={k} type="button" className={flt === k ? 'ce-on' : ''} onClick={() => setFlt(k)}>{l}</button>)}
                </div>
              </div>
              {shown.map((c) => (
                <button key={c.id} type="button" className={'ce-li' + (c.id === selId ? ' ce-sel' : '')} onClick={() => setSelId(c.id)}>
                  {c.logo_url
                    ? <span className={'ce-tl ce-tl-logo' + (c.is_active ? '' : ' ce-tl-off')}><CompanyLogo value={c.logo_url} alt={c.name} fallback={<span className="ce-tl-ini" style={{ background: c.primary_color, color: ink(c.primary_color) }}>{initial(c.name)}</span>} /></span>
                    : <span className="ce-tl" style={c.is_active ? { background: c.primary_color, color: ink(c.primary_color) } : { background: '#8A94A3', color: '#fff' }}>{initial(c.name)}</span>}
                  <span className="ce-lt">
                    <span className="ce-ti">{c.name} {c.is_system ? <span className="ce-chip ce-c-s">Sistema</span> : !c.is_active ? <span className="ce-chip ce-c-c">Inativa</span> : null}</span>
                    <span className="ce-su">{c.slug} · {c.active_users} {c.active_users === 1 ? 'ativo' : 'ativos'} de {c.total_users}</span>
                  </span>
                </button>
              ))}
              <div className="ce-cnt">{plural(shown.length, 'empresa', 'empresas')}</div>
            </aside>

            {form && sel ? (
              <main className="ce-panel" aria-label="Dados da empresa">
                <div className="ce-dh">
                  <div className="ce-big" style={sel.logo_url ? { background: '#fff', border: '1px solid #E3E6EB', padding: 6 } : { background: sel.primary_color, color: ink(sel.primary_color) }}>{sel.logo_url ? <CompanyLogo value={sel.logo_url} alt={sel.name} fallback={<>{initial(sel.name)}</>} /> : initial(sel.name)}</div>
                  <div>
                    <h2>{sel.name} {sel.is_system ? <span className="ce-chip ce-c-s">Sistema</span> : <span className={'ce-chip ' + (sel.is_active ? 'ce-c-a' : 'ce-c-c')}>{sel.is_active ? 'Ativa' : 'Inativa'}</span>}</h2>
                    <div className="ce-su">{sel.slug} · {plural(sel.active_users, 'usuário ativo', 'usuários ativos')} · {sel.total_users} total · {plural(sel.admins, 'administrador', 'administradores')}</div>
                  </div>
                  <div className="ce-acts">
                    {!sel.is_system ? <label className="ce-ac">Empresa ativa <Switch on={sel.is_active} label="Empresa ativa" onClick={() => void toggleActive()} /></label> : null}
                    <button type="button" className="ce-btn ce-pri" onClick={() => void save()} disabled={saving || !dirty}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Salvar alterações</button>
                  </div>
                </div>

                <section className="ce-sc">
                  <div><h3>Dados da empresa</h3><div className="ce-hp">Nome, identificador e logo exibidos para os usuários.</div></div>
                  <div className="ce-gr">
                    <div className="ce-f"><label htmlFor="ce-n">Nome da empresa</label><input id="ce-n" className="ce-in" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
                    <div className="ce-f"><label htmlFor="ce-s">Identificador (slug)</label><input id="ce-s" className="ce-in" type="text" value={form.slug} disabled title="O identificador não muda depois de criado, para não quebrar o acesso dos usuários." /></div>
                    <div className="ce-f" style={{ gridColumn: 'span 2' }}>
                      <label>Logo</label>
                      <div className="ce-lg">
                        <div className="ce-lgb">{form.logo_url ? <CompanyLogo value={form.logo_url} alt={form.name} /> : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></svg>}</div>
                        <div>
                          <button type="button" className="ce-btn" onClick={() => fileRef.current?.click()}>Enviar logo</button>
                          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadLogo(f); }} />
                          <div className="ce-su" style={{ marginTop: 6 }}>PNG ou SVG com fundo transparente.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="ce-sc">
                  <div><h3>Aparência</h3><div className="ce-hp">Cores da empresa usadas no sistema.</div></div>
                  <div className="ce-gr">
                    {(['primary_color', 'secondary_color'] as const).map((k, i) => (
                      <div className="ce-f" key={k}>
                        <label htmlFor={'ce-' + k}>{i ? 'Cor secundária' : 'Cor primária'}</label>
                        <div className="ce-cl">
                          <label className="ce-sq" style={{ background: form[k] }} aria-label={i ? 'Escolher cor secundária' : 'Escolher cor primária'}><input type="color" value={/^#[0-9a-f]{6}$/i.test(form[k]) ? form[k] : '#000000'} onChange={(e) => set({ [k]: e.target.value.toUpperCase() } as Partial<CompanyStats>)} /></label>
                          <input id={'ce-' + k} className="ce-in" type="text" value={form[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<CompanyStats>)} />
                        </div>
                      </div>
                    ))}
                    <div className="ce-pv"><div style={{ background: form.primary_color }} /><div style={{ background: form.secondary_color }} /></div>
                  </div>
                </section>

                <section className="ce-sc">
                  <div><h3>Módulos habilitados</h3><div className="ce-hp">O que a empresa pode usar. Módulos fora do plano ficam bloqueados.</div></div>
                  <div className="ce-mg">
                    {MODULES.map((m) => {
                      const on = form.enabled_modules.includes(m.id);
                      const out = !sel.is_system && !!plan && !!m.feature && !plan.features.includes(m.feature);
                      return (
                        <div className="ce-md" key={m.id}>
                          <span>{m.label} {out ? <span className="ce-mt">Fora do plano</span> : null}</span>
                          <Switch on={on} label={m.label} onClick={() => set({ enabled_modules: on ? form.enabled_modules.filter((x) => x !== m.id) : [...form.enabled_modules, m.id] })} />
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="ce-sc">
                  <div><h3>Administradores</h3><div className="ce-hp">Quem gerencia esta empresa.</div></div>
                  <div>
                    {admins.map((u) => (
                      <div className="ce-ad" key={u.profile_id}>
                        <span className="ce-mav">{initial(u.display_name || u.name)}</span>
                        <div><div className="ce-tt">{u.display_name || u.name}</div><div className="ce-su">{u.email}</div></div>
                        {!sel.is_system ? <button type="button" className="ce-lk" disabled={busy === 'adm:' + u.user_id || admins.length <= 1} title={admins.length <= 1 ? 'A empresa precisa ter pelo menos um administrador' : undefined} onClick={() => void removeAdmin(u)}>Remover</button> : null}
                      </div>
                    ))}
                    {!admins.length ? <div className="ce-su" style={{ marginBottom: 10 }}>Nenhum administrador cadastrado.</div> : null}
                    {!sel.is_system ? <button type="button" className="ce-btn" onClick={() => setOpenAdmin(true)}>+ Adicionar administrador</button> : null}
                  </div>
                </section>

                <section className="ce-sc">
                  <div><h3>Assinatura</h3><div className="ce-hp">Plano contratado pela empresa.</div></div>
                  {sel.is_system ? <div className="ce-kv"><span>Situação</span><b><span className="ce-chip ce-c-s">Empresa do sistema: isenta</span></b></div> : (
                    <div>
                      <div className="ce-kv">
                        <span>Plano</span><b>{plan ? `${plan.name} · ${brl(planPrice)}/${cycle}` : 'Sem plano definido'}</b>
                        <span>Situação</span><b>{sub ? <span className={'ce-chip ' + (SUB_LABEL[sub.status]?.[1] || 'ce-c-c')}>{SUB_LABEL[sub.status]?.[0] || sub.status}</span> : '—'}</b>
                        <span>Válido até</span><b>{sub?.status === 'trialing' && sub.trial_ends_at ? dDay(sub.trial_ends_at) : sub?.current_period_end ? dDay(sub.current_period_end) : '—'}</b>
                        <span>Último pagamento</span><b>{lastPay ? `${dLong(lastPay.paid_at)} · Mercado Pago${lastPay.provider_payment_id ? ' · ID ' + lastPay.provider_payment_id : ''}` : 'Nenhum pagamento registrado'}</b>
                        <span>Recibo</span><b>{lastRec ? <button type="button" className="ce-lk" style={{ padding: 0 }} disabled={busy === 'rec:' + lastRec.id} onClick={() => void downloadReceipt(lastRec)}>{busy === 'rec:' + lastRec.id ? 'Gerando…' : recNo(lastRec.receipt_number)}</button> : '—'}</b>
                      </div>
                      <button type="button" className="ce-btn" style={{ marginTop: 14 }} onClick={() => setOpenPlan(true)}>Editar plano e situação</button>
                    </div>
                  )}
                </section>

                <section className="ce-sc">
                  <div><h3>Atividade recente</h3><div className="ce-hp">Pagamentos e assinatura desta empresa.</div></div>
                  <div>
                    {events.length ? events.map((e, i) => (
                      <div className="ce-ev" key={i}><span className="ce-dt" /><div><b>{e.title}</b><div className="ce-su">{e.sub}</div></div><span className="ce-su">{dShort(e.t)}</span></div>
                    )) : <div className="ce-su">Nenhum pagamento ou assinatura registrado ainda.</div>}
                  </div>
                </section>

                {!sel.is_system ? (
                  <section className="ce-sc" style={{ borderBottom: 0 }}>
                    <div><h3>Excluir empresa</h3><div className="ce-hp">Apaga para sempre todos os dados da empresa. Não dá para desfazer.</div></div>
                    <div><button type="button" className="ce-btn ce-red" onClick={() => { setDeleteName(''); setDeleteOpen(true); }}>Excluir empresa</button></div>
                  </section>
                ) : null}

                <div className="ce-ff">
                  <button type="button" className="ce-btn" disabled={!dirty || saving} onClick={() => setForm({ ...sel, enabled_modules: [...sel.enabled_modules] })}>Cancelar</button>
                  <button type="button" className="ce-btn ce-pri" disabled={!dirty || saving} onClick={() => void save()}>Salvar alterações</button>
                </div>
              </main>
            ) : <main className="ce-panel ce-empty">Selecione uma empresa.</main>}
          </div>
        </>
      ) : (
        <>
          <div className="ce-panel ce-kp">
            <div className="ce-k"><span>Ativas</span><b>{sigCount.active}</b></div>
            <div className="ce-k"><span>Canceladas</span><b>{sigCount.canceled}</b></div>
            <div className="ce-k"><span>Expiradas sem pagamento</span><b>{sigCount.expired}</b></div>
            <div className="ce-k"><span>Receita mensal ativa</span><b>{brl(monthly)}</b></div>
          </div>
          <div className="ce-panel">
            <div className="ce-sh">
              <div><b>Assinaturas pelo site</b><p>Empresas que assinaram em /assinar. A conferência com o Mercado Pago também roda sozinha a cada 5 minutos.</p></div>
              <div className="ce-fl">
                {([['all', 'Todas'], ['active', 'Ativas'], ['canceled', 'Canceladas'], ['expired', 'Expiradas'], ['error', 'Com erro']] as const).map(([k, l]) => <button key={k} type="button" className={sigFlt === k ? 'ce-on' : ''} onClick={() => setSigFlt(k)}>{l} {sigCount[k]}</button>)}
              </div>
            </div>
            {!sigShown.length ? <div className="ce-empty">Nenhuma assinatura neste filtro.</div> : (
              <div className="ce-tw">
                <table>
                  <thead><tr><th>Empresa</th><th>Plano</th><th>Valor</th><th>Data e hora</th><th>Situação</th><th>Observação</th><th /></tr></thead>
                  <tbody>
                    {sigShown.map((s) => {
                      const [lab, tone] = SIGNUP_LABEL[s.status] || [s.status, 'ce-c-c'];
                      const canOpen = s.status === 'active' && !!s.company_id && companies.some((c) => c.id === s.company_id);
                      return (
                        <tr key={s.id}>
                          <td><div className="ce-tt">{s.company_name}</div><div className="ce-su">{s.admin_email}</div></td>
                          <td>{s.plan_id}</td>
                          <td>{brl(s.amount_cents)}/{s.billing_cycle === 'annual' ? 'ano' : 'mês'}</td>
                          <td>{dShort(s.created_at)}</td>
                          <td><span className={'ce-chip ' + tone}>{lab}</span></td>
                          <td>{s.error && s.status !== 'active' ? <span className="ce-er" style={{ marginTop: 0, display: 'block' }}>{s.error}</span> : '—'}</td>
                          <td style={{ textAlign: 'right' }}>{canOpen ? <button type="button" className="ce-lk" onClick={() => openCompany(s.company_id!)}>Abrir empresa</button> : <button type="button" className="ce-lk" onClick={() => setSigDetail(s)}>Detalhes</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Nova empresa */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Ex.: Nuvexa" /></div>
            <div><Label>Identificador (slug)</Label><Input value={nSlug} onChange={(e) => setNSlug(e.target.value)} placeholder="grupo-servsul" /></div>
            <div className="grid grid-cols-2 gap-3">
              {([['Primária', nPrimary, setNPrimary], ['Secundária', nSecondary, setNSecondary]] as const).map(([l, v, fn]) => (
                <div key={l}><Label>{l}</Label><div className="flex gap-2"><input type="color" value={v} onChange={(e) => fn(e.target.value)} className="w-12 h-10 rounded border" /><Input value={v} onChange={(e) => fn(e.target.value)} /></div></div>
              ))}
            </div>
            <div className="space-y-3 rounded-xl border p-3">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={trialOn} onChange={(e) => setTrialOn(e.target.checked)} /> Período de avaliação</label>
              {trialOn ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Avaliação até</Label><Input type="date" value={trialUntil} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setTrialUntil(e.target.value)} /></div>
                  <div><Label>Plano em teste</Label><Sel className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={trialPlan} onChange={(e) => setTrialPlan(e.target.value)}><option value="essencial">Essencial</option><option value="profissional">Profissional</option><option value="empresarial">Empresarial</option></Sel></div>
                  <p className="col-span-2 text-xs text-muted-foreground">A empresa fica ativa até essa data. O administrador é avisado 7 dias antes e no vencimento (com 30 dias para assinar); depois disso, você decide no chat Comunicados se os dados serão excluídos.</p>
                </div>
              ) : null}
            </div>
            <Button className="w-full" onClick={() => void handleCreate()} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar empresa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Novo administrador */}
      <Dialog open={openAdmin} onOpenChange={setOpenAdmin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar administrador{sel ? ' · ' + sel.name : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={aName} onChange={(e) => setAName(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></div>
            <div><Label>Senha</Label><Input type="password" autoComplete="new-password" maxLength={72} value={aPass} onChange={(e) => setAPass(e.target.value)} /><PasswordChecklist value={aPass} className="mt-2" /></div>
            <Button className="w-full" onClick={() => void handleCreateAdmin()} disabled={creatingAdmin}>{creatingAdmin && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar administrador</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar plano */}
      <Dialog open={openPlan} onOpenChange={(o) => { setOpenPlan(o); if (!o) void load(); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Plano e situação{sel ? ' · ' + sel.name : ''}</DialogTitle></DialogHeader>
          {sel ? <CompanyPlanPanel companyId={sel.id} isSystem={sel.is_system} userCount={sel.active_users} /> : null}
        </DialogContent>
      </Dialog>

      {/* Detalhes da assinatura pelo site */}
      <Dialog open={!!sigDetail} onOpenChange={(o) => { if (!o) setSigDetail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sigDetail?.company_name}</DialogTitle></DialogHeader>
          {sigDetail ? (
            <div className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-2 text-sm">
              <span className="text-muted-foreground">Situação</span><b className="font-medium">{(SIGNUP_LABEL[sigDetail.status] || [sigDetail.status])[0]}</b>
              <span className="text-muted-foreground">Administrador</span><b className="font-medium">{sigDetail.admin_name || '—'} · {sigDetail.admin_email}</b>
              <span className="text-muted-foreground">Plano</span><b className="font-medium">{sigDetail.plan_id} · {brl(sigDetail.amount_cents)}/{sigDetail.billing_cycle === 'annual' ? 'ano' : 'mês'}</b>
              <span className="text-muted-foreground">Criada em</span><b className="font-medium">{dLong(sigDetail.created_at)}</b>
              <span className="text-muted-foreground">Pagamento</span><b className="font-medium">{sigDetail.paid_at ? dLong(sigDetail.paid_at) : 'Não confirmado'}</b>
              <span className="text-muted-foreground">Ativada em</span><b className="font-medium">{sigDetail.activated_at ? dLong(sigDetail.activated_at) : '—'}</b>
              <span className="text-muted-foreground">Tentativas</span><b className="font-medium">{sigDetail.attempts}</b>
              {sigDetail.error ? <><span className="text-muted-foreground">Observação</span><b className="font-medium text-destructive">{sigDetail.error}</b></> : null}
            </div>
          ) : null}
          <DialogFooter>{sigDetail?.company_id && companies.some((c) => c.id === sigDetail.company_id) ? <Button onClick={() => { const id = sigDetail.company_id!; setSigDetail(null); openCompany(id); }}>Abrir empresa</Button> : null}<Button variant="outline" onClick={() => setSigDetail(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir empresa */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Excluir “{sel?.name}”?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Isso apaga <b>definitivamente</b> a empresa e tudo ligado a ela: todos os colaboradores (e o login deles), setores, conversas, grupos, tarefas e murais, avisos, avaliações, salas de reunião, chamados e configurações.</p>
            <p>Para confirmar, digite o nome da empresa: <b>{sel?.name}</b></p>
            <Input value={deleteName} onChange={(e) => setDeleteName(e.target.value)} placeholder={sel?.name} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleting || !sel || deleteName.trim() !== sel.name.trim()} onClick={async () => {
              if (!sel) return;
              setDeleting(true);
              const { data, error } = await db.rpc('super_admin_delete_company', { _company_id: sel.id, _confirm_name: deleteName.trim() });
              setDeleting(false);
              if (error) { toast.error('Não foi possível excluir a empresa.'); return; }
              toast.success(`Empresa excluída (${data?.people ?? 0} colaboradores removidos)`);
              setDeleteOpen(false); setSelId(null); void load();
            }}>{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Excluir definitivamente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
