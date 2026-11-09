// Company admin: connect Slack, Microsoft Teams and WhatsApp (Google Agenda/Drive come next).
// Secrets go straight to the `integrations` edge function, which encrypts them; this screen never reads them back.
import { useCallback, useEffect, useState } from 'react';
import { Plug, Loader2, Send, Trash2, CheckCircle2, AlertCircle, CalendarDays, HardDrive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { appConfirm, appPrompt } from '@/lib/appDialog';
import { toast } from 'sonner';

type Provider = 'slack' | 'teams' | 'whatsapp';
type Row = { provider: Provider; enabled: boolean; events: string[]; config: any; last_status: string | null; last_error: string | null; last_used_at: string | null };
type Delivery = { id: number; provider: string; event: string; ok: boolean; detail: string | null; created_at: string };

const EVENT_LABEL: Record<string, string> = { announcement: 'Avisos', important: 'Comunicados importantes', task_assigned: 'Card atribuído', meeting: 'Reuniões marcadas' };
const META: Record<Provider, { name: string; color: string; letter: string; secretLabel: string; placeholder: string; defaults: string[]; steps: string[] }> = {
  slack: {
    name: 'Slack', color: '#4A154B', letter: 'S', secretLabel: 'Link do Incoming Webhook', placeholder: 'https://hooks.slack.com/services/…', defaults: ['announcement', 'important', 'task_assigned', 'meeting'],
    steps: ['No Slack, abra api.slack.com/apps e crie um app (From scratch).', 'Em "Incoming Webhooks", ative e clique em "Add New Webhook to Workspace".', 'Escolha o canal que vai receber as mensagens e copie o link gerado.'],
  },
  teams: {
    name: 'Microsoft Teams', color: '#5059C9', letter: 'T', secretLabel: 'Link do fluxo (Workflows)', placeholder: 'https://…logic.azure.com/… ou …powerplatform.com/…', defaults: ['announcement', 'important', 'task_assigned', 'meeting'],
    steps: ['No canal do Teams, clique em ⋯ > Workflows.', 'Escolha o modelo "Postar em um canal quando uma solicitação de webhook for recebida".', 'Conclua o assistente e copie o link do fluxo.'],
  },
  whatsapp: {
    name: 'WhatsApp Business', color: '#25D366', letter: 'W', secretLabel: 'Token de acesso permanente', placeholder: 'EAAG…', defaults: ['important', 'task_assigned'],
    steps: ['Em developers.facebook.com, crie um app do tipo Empresa e adicione o produto WhatsApp.', 'Cadastre o número da empresa e copie o "Phone number ID".', 'Crie e aprove um modelo de mensagem com uma variável no corpo, por exemplo: "Aviso do ewvon: {{1}}".', 'Gere um token permanente (usuário do sistema com permissão whatsapp_business_messaging).'],
  },
};

async function call(route: string, body: unknown) {
  const { data, error } = await supabase.functions.invoke(`integrations/${route}`, { body });
  if (error) { let msg = 'Não foi possível concluir.'; try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ } throw new Error(msg); }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

function ProviderCard({ provider, row, onChanged }: { provider: Provider; row?: Row; onChanged: () => void }) {
  const meta = META[provider];
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>(row?.events ?? meta.defaults);
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [cfg, setCfg] = useState({ phone_number_id: row?.config?.phone_number_id ?? '', template_name: row?.config?.template_name ?? '', language: row?.config?.language ?? 'pt_BR' });
  const [busy, setBusy] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(!row);
  useEffect(() => { setEvents(row?.events ?? meta.defaults); setEnabled(row?.enabled ?? true); }, [row, meta.defaults]);

  const save = async () => {
    setBusy('save');
    try { await call('save', { provider, enabled, events, config: cfg, secret: secret || undefined }); setSecret(''); toast.success(`${meta.name} salvo.`); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const test = async () => {
    let to: string | null | undefined;
    if (provider === 'whatsapp') { to = await appPrompt({ title: 'Enviar teste pelo WhatsApp', message: 'Celular que vai receber o teste, com DDD.', placeholder: '(11) 91234-5678' }); if (!to) return; }
    setBusy('test');
    try { const r = await call('test', { provider, to }); toast.success(r.detail || 'Mensagem de teste enviada.'); onChanged(); }
    catch (e) { toast.error((e as Error).message); onChanged(); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!(await appConfirm({ title: `Desconectar ${meta.name}?`, message: 'As mensagens automáticas para este serviço param na hora.', confirmText: 'Desconectar', danger: true }))) return;
    setBusy('remove');
    try { await call('remove', { provider }); toast.success(`${meta.name} desconectado.`); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-bold text-white" style={{ background: meta.color }}>{meta.letter}</span>
          <div>
            <p className="text-[15px] font-semibold">{meta.name}</p>
            <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
              {!row ? 'Não conectado' : row.last_status === 'erro'
                ? <><AlertCircle className="h-3.5 w-3.5 text-destructive" />Último envio falhou</>
                : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Conectado{row.last_used_at ? ` · último envio ${new Date(row.last_used_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}</>}
            </p>
          </div>
        </div>
        {row ? <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar" /> : null}
      </div>
      {row?.last_status === 'erro' && row.last_error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{row.last_error}</p> : null}

      <button type="button" className="text-[12px] font-medium text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowHelp((v) => !v)}>{showHelp ? 'Ocultar passo a passo' : 'Como conseguir os dados'}</button>
      {showHelp ? <ol className="list-decimal space-y-1 pl-5 text-[12px] text-muted-foreground">{meta.steps.map((s) => <li key={s}>{s}</li>)}</ol> : null}

      {provider === 'whatsapp' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Phone number ID" value={cfg.phone_number_id} onChange={(e) => setCfg({ ...cfg, phone_number_id: e.target.value.replace(/\D/g, '') })} />
          <Input placeholder="Nome do modelo" value={cfg.template_name} onChange={(e) => setCfg({ ...cfg, template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
          <Input placeholder="Idioma (pt_BR)" value={cfg.language} onChange={(e) => setCfg({ ...cfg, language: e.target.value })} />
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-[12px] text-muted-foreground">{meta.secretLabel}{row ? ' · já salvo, preencha só para trocar' : ''}</p>
        <Input type="password" autoComplete="off" placeholder={row ? '••••••••••••' : meta.placeholder} value={secret} onChange={(e) => setSecret(e.target.value)} />
      </div>
      <div>
        <p className="mb-1.5 text-[12px] text-muted-foreground">Enviar quando houver</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EVENT_LABEL).filter(([k]) => provider !== 'whatsapp' || k === 'important' || k === 'task_assigned').map(([k, label]) => {
            const on = events.includes(k);
            return <button key={k} type="button" onClick={() => setEvents(on ? events.filter((e) => e !== k) : [...events, k])} className={`rounded-full border px-3 py-1 text-[12px] font-medium ${on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`} aria-pressed={on}>{label}</button>;
          })}
        </div>
        {provider === 'whatsapp' ? <p className="mt-1.5 text-[11px] text-muted-foreground">Comunicados vão para todos os funcionários com celular no cadastro; cards vão só para o responsável.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-9" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{row ? 'Salvar alterações' : 'Conectar'}</Button>
        {row ? <Button size="sm" variant="outline" className="h-9" onClick={() => void test()} disabled={busy !== null}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar teste</Button> : null}
        {row ? <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={() => void remove()} disabled={busy !== null}><Trash2 className="mr-2 h-4 w-4" />Desconectar</Button> : null}
      </div>
    </CardContent></Card>
  );
}

export function IntegrationsSection() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [{ data: r }, { data: d }] = await Promise.all([
      (supabase as any).from('company_integrations').select('provider, enabled, events, config, last_status, last_error, last_used_at'),
      (supabase as any).from('integration_deliveries').select('id, provider, event, ok, detail, created_at').order('created_at', { ascending: false }).limit(15),
    ]);
    setRows((r || []) as Row[]); setLog((d || []) as Delivery[]); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!isAdmin) return <div className="p-8 text-center text-sm text-muted-foreground">Somente o administrador da empresa configura integrações.</div>;
  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader icon={<Plug />} title="Integrações" subtitle="Leve avisos, comunicados, cards e reuniões do ewvon para as ferramentas que a equipe já usa." />
      {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
            {(['slack', 'teams', 'whatsapp'] as Provider[]).map((p) => <ProviderCard key={p} provider={p} row={rows.find((r) => r.provider === p)} onChanged={() => void load()} />)}
            <Card><CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4285F4] text-white"><CalendarDays className="h-5 w-5" /></span>
                <div><p className="text-[15px] font-semibold">Google Agenda e Google Drive</p><p className="text-[12px] text-muted-foreground">Em preparação</p></div>
              </div>
              <p className="text-[13px] text-muted-foreground">Cada pessoa vai poder ligar a própria conta Google: as reuniões do calendário do ewvon aparecem na Agenda Google, e os cards ganham o botão <HardDrive className="inline h-3.5 w-3.5" /> “Anexar do Drive”, sem gastar o armazenamento do plano.</p>
            </CardContent></Card>
          </div>
          <Card><CardContent className="p-0">
            <div className="border-b border-border px-4 py-3"><p className="text-[15px] font-semibold">Últimos envios</p></div>
            {!log.length ? <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum envio ainda.</p> : (
              <div className="divide-y divide-border">{log.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">{d.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}<span className="truncate">{META[d.provider as Provider]?.name || d.provider} · {d.event === 'test' ? 'Teste' : EVENT_LABEL[d.event] || d.event}{d.detail ? ` · ${d.detail}` : ''}</span></span>
                  <span className="shrink-0 text-muted-foreground">{new Date(d.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}</div>
            )}
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
