// Company admin: connect Slack, Microsoft Teams and WhatsApp.
// Secrets go straight to the `integrations` edge function, which encrypts them; this screen never reads them back.
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { appConfirm, appPrompt } from '@/lib/appDialog';
import { toast } from 'sonner';
import { AiCard, type AiRow } from '@/components/integrations/AiCard';
import { HrCard } from '@/components/integrations/HrCard';
import { GuideDropdown, SlackGuide, TeamsGuide, WhatsAppGuide } from '@/components/integrations/IntegrationGuides';

type Provider = 'slack' | 'teams' | 'whatsapp';
type Row = { provider: Provider; enabled: boolean; events: string[]; config: any; last_status: string | null; last_error: string | null; last_used_at: string | null };
type Delivery = { id: number; provider: string; event: string; ok: boolean; detail: string | null; created_at: string };

const EVENT_LABEL: Record<string, string> = { announcement: 'Avisos', task_assigned: 'Card atribuído', meeting: 'Reuniões marcadas' };
const META: Record<Provider, { name: string; color: string; letter: string; secretLabel: string; placeholder: string; defaults: string[] }> = {
  slack: {
    name: 'Slack', color: '#4A154B', letter: 'S', secretLabel: 'Link do Incoming Webhook', placeholder: 'https://hooks.slack.com/services/…', defaults: ['announcement', 'task_assigned', 'meeting'],
  },
  teams: {
    name: 'Microsoft Teams', color: '#5059C9', letter: 'T', secretLabel: 'Link do fluxo (Workflows)', placeholder: 'https://…logic.azure.com/… ou …powerplatform.com/…', defaults: ['announcement', 'task_assigned', 'meeting'],
  },
  whatsapp: {
    name: 'WhatsApp Business', color: '#25D366', letter: 'W', secretLabel: 'Token de acesso permanente', placeholder: 'EAAG…', defaults: ['task_assigned'],
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
    <div className="dk-panel dk-pad">
      <div className="dk-hd">
        <span className="dk-tile" style={{ background: meta.color }}>{meta.letter}</span>
        <div>
          <h2>{meta.name}</h2>
          <span className={`dk-stt${row && row.last_status !== 'erro' ? ' on' : ''}`}>
            {!row ? 'Não conectado' : row.last_status === 'erro' ? 'Último envio falhou' : `Conectado${row.last_used_at ? ` · último envio ${new Date(row.last_used_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </span>
        </div>
        {row ? <span className="dk-sp"><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar" /></span> : null}
      </div>
      {row?.last_status === 'erro' && row.last_error ? <div className="dk-err">{row.last_error}</div> : null}

      <GuideDropdown title={row ? 'Passo a passo detalhado' : 'Como conseguir os dados (passo a passo detalhado)'}>
        {provider === 'slack' ? <SlackGuide /> : provider === 'teams' ? <TeamsGuide /> : <WhatsAppGuide />}
      </GuideDropdown>

      {provider === 'whatsapp' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Phone number ID" value={cfg.phone_number_id} onChange={(e) => setCfg({ ...cfg, phone_number_id: e.target.value.replace(/\D/g, '') })} />
          <Input placeholder="Nome do modelo" value={cfg.template_name} onChange={(e) => setCfg({ ...cfg, template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
          <Input placeholder="Idioma (pt_BR)" value={cfg.language} onChange={(e) => setCfg({ ...cfg, language: e.target.value })} />
        </div>
      ) : null}
      <div>
        <p className="lbl" style={{ marginBottom: 6 }}>{meta.secretLabel}{row ? ' · já salvo, preencha só para trocar' : ''}</p>
        <Input type="password" autoComplete="off" placeholder={row ? '••••••••••••' : meta.placeholder} value={secret} onChange={(e) => setSecret(e.target.value)} />
      </div>
      <div>
        <p className="lbl" style={{ marginBottom: 8 }}>Enviar quando houver</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(EVENT_LABEL).filter(([k]) => provider !== 'whatsapp' || k === 'announcement' || k === 'task_assigned').map(([k, label]) => {
            const on = events.includes(k);
            return <button key={k} type="button" onClick={() => setEvents(on ? events.filter((e) => e !== k) : [...events, k])} className="ui-chip" aria-pressed={on}>{label}</button>;
          })}
        </div>
        {provider === 'whatsapp' ? <p className="dk-hp">Avisos vão para todos os funcionários com celular no cadastro (cada mensagem é cobrada pela Meta); cards vão só para o responsável.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="dk-btn pri" type="button" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{row ? 'Salvar alterações' : 'Conectar'}</button>
        {row ? <button className="dk-btn" type="button" onClick={() => void test()} disabled={busy !== null}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar teste</button> : null}
        {row ? <button className="dk-btn" style={{ color: '#8E1B10' }} type="button" onClick={() => void remove()} disabled={busy !== null}><Trash2 className="mr-2 h-4 w-4" />Desconectar</button> : null}
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sistema' | 'dash' | 'ia' | 'msg'>('sistema');
  const load = useCallback(async () => {
    const [{ data: r }, { data: d }] = await Promise.all([
      (supabase as any).from('company_integrations').select('provider, enabled, events, config, last_status, last_error, last_used_at'),
      (supabase as any).from('integration_deliveries').select('id, provider, event, ok, detail, created_at').order('created_at', { ascending: false }).limit(15),
    ]);
    setRows((r || []) as Row[]); setLog((d || []) as Delivery[]); setLoading(false);
  }, []);
  useEffect(() => { if (isAdmin) void load(); }, [load, isAdmin]);

  if (!isAdmin) return <div className="dk-pg"><div className="dk-empty">Somente o administrador da empresa configura integrações.</div></div>;
  return (
    <div className="dk-pg dk-cards">
      {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <>
          <div className="dk-seg" role="group" aria-label="Integrações" style={{ alignSelf: 'flex-start' }}>
            {([['sistema', 'Sistema de RH'], ['dash', 'Dash 3D'], ['ia', 'IA'], ['msg', 'Mensagens']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          {tab === 'sistema' ? <HrCard view="sistema" /> : null}
          {tab === 'dash' ? <HrCard view="dash" /> : null}
          {tab === 'ia' ? <AiCard row={rows.find((r) => (r.provider as string) === 'claude') as unknown as AiRow | undefined} onChanged={() => void load()} /> : null}
          {tab === 'msg' ? (
            <>
              <div className="dk-g3">
                {(['slack', 'teams', 'whatsapp'] as Provider[]).map((p) => <ProviderCard key={p} provider={p} row={rows.find((r) => r.provider === p)} onChanged={() => void load()} />)}
              </div>
          <div className="dk-panel dk-pad" style={{ padding: 0 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E1E5EB', fontWeight: 600, fontSize: 15 }}>Últimos envios</div>
            {!log.length ? <p className="dk-empty" style={{ textAlign: 'left' }}>Nenhum envio ainda.</p> : (
              <div>{log.map((d) => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 24px', borderBottom: '1px solid #E9ECF0', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><i className="dk-dt" style={{ background: d.ok ? '#0A6B3D' : '#8E1B10' }} /><span className="truncate">{META[d.provider as Provider]?.name || d.provider} · {d.event === 'test' ? 'Teste' : EVENT_LABEL[d.event] || d.event}{d.detail ? ` · ${d.detail}` : ''}</span></span>
                  <span style={{ color: '#4A5563' }}>{new Date(d.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}</div>
            )}
          </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
