// Company admin: bring attendance data (presence, delays, absences, hours bank) from a third-party HR / time-clock system into the Dash 3D.
// Data only feeds the Dash. The secret goes straight to the `hr-sync` edge function (encrypted there); this screen never reads it back.
import { useEffect, useState } from 'react';
import { Users, Loader2, Trash2, CheckCircle2, AlertCircle, Plus, X, RefreshCw, PlugZap, Copy, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { toast } from 'sonner';
import { GuideDropdown, HrGuide } from '@/components/integrations/IntegrationGuides';

type HrStatus = 'present' | 'late' | 'absent' | 'vacation' | 'leave' | 'off';
type HrConfig = {
  vendor?: string; base_url?: string; list_path?: string; method?: 'GET' | 'POST';
  auth?: { type?: 'bearer' | 'header' | 'basic'; header_name?: string };
  array_path?: string; match?: { by?: 'email' | 'cpf' | 'registration'; field?: string };
  fields?: { status?: string; clock_in?: string; bank_minutes?: string };
  status_map?: Record<string, HrStatus>; interval_min?: number; params?: Record<string, string>;
};
export type HrRow = { enabled: boolean; config: HrConfig | null; last_status: string | null; last_error: string | null; last_used_at: string | null };
type Sample = { matched: boolean; identifier: string | null; status: string | null; clock_in: string | null; bank_minutes: number | null };

const STATUS_LABEL: Record<HrStatus, string> = { present: 'Presente', late: 'Atrasado', absent: 'Falta', vacation: 'Férias', leave: 'Afastado', off: 'Folga' };
const VENDORS = ['Ahgora', 'Nexti', 'Convenia', 'Pontotel', 'Outro'];
const BY_LABEL = { email: 'E-mail', cpf: 'CPF', registration: 'Matrícula' } as const;
const AUTH_LABEL = { bearer: 'Token (Bearer)', header: 'Cabeçalho próprio', basic: 'Usuário:senha (Basic)' } as const;
const EXAMPLE = `{
  "records": [
    {
      "email": "maria@empresa.com.br",
      "status": "present",
      "clock_in": "2026-11-12T08:02:00-03:00",
      "hours_bank_minutes": 120
    }
  ]
}`;

async function call(route: string, body: unknown) {
  const { data, error } = await supabase.functions.invoke(`hr-sync/${route}`, { body });
  if (error) { let msg = 'Não foi possível concluir.'; try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ } throw new Error(msg); }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const fmtBank = (m: number | null) => (m == null ? '—' : `${m < 0 ? '-' : '+'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}h${String(Math.abs(m) % 60).padStart(2, '0')}`);

function copy(text: string, what: string) {
  try { void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copiado.`), () => toast.error('Não foi possível copiar.')); }
  catch { toast.error('Não foi possível copiar.'); }
}

export function HrCard({ row, onChanged }: { row?: HrRow; onChanged: () => void }) {
  const c = row?.config ?? {};
  const [tab, setTab] = useState<'api' | 'push'>('api');
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [vendor, setVendor] = useState(c.vendor ?? '');
  const [baseUrl, setBaseUrl] = useState(c.base_url ?? '');
  const [listPath, setListPath] = useState(c.list_path ?? '');
  const [method, setMethod] = useState<'GET' | 'POST'>(c.method ?? 'GET');
  const [authType, setAuthType] = useState<'bearer' | 'header' | 'basic'>(c.auth?.type ?? 'bearer');
  const [headerName, setHeaderName] = useState(c.auth?.header_name ?? '');
  const [secret, setSecret] = useState('');
  const [arrayPath, setArrayPath] = useState(c.array_path ?? '');
  const [matchBy, setMatchBy] = useState<'email' | 'cpf' | 'registration'>(c.match?.by ?? 'email');
  const [matchField, setMatchField] = useState(c.match?.field ?? '');
  const [fStatus, setFStatus] = useState(c.fields?.status ?? '');
  const [fClock, setFClock] = useState(c.fields?.clock_in ?? '');
  const [fBank, setFBank] = useState(c.fields?.bank_minutes ?? '');
  const [map, setMap] = useState<{ k: string; v: HrStatus }[]>(Object.entries(c.status_map ?? {}).map(([k, v]) => ({ k, v })));
  const [interval, setIntervalMin] = useState(String(c.interval_min ?? 15));
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ sample: Sample[]; total: number; matched: number } | null>(null);
  const [ingest, setIngest] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    const k = row?.config ?? {};
    setEnabled(row?.enabled ?? true); setVendor(k.vendor ?? ''); setBaseUrl(k.base_url ?? ''); setListPath(k.list_path ?? ''); setMethod(k.method ?? 'GET');
    setAuthType(k.auth?.type ?? 'bearer'); setHeaderName(k.auth?.header_name ?? ''); setArrayPath(k.array_path ?? '');
    setMatchBy(k.match?.by ?? 'email'); setMatchField(k.match?.field ?? ''); setFStatus(k.fields?.status ?? ''); setFClock(k.fields?.clock_in ?? ''); setFBank(k.fields?.bank_minutes ?? '');
    setMap(Object.entries(k.status_map ?? {}).map(([a, v]) => ({ k: a, v }))); setIntervalMin(String(k.interval_min ?? 15));
  }, [row]);

  const failed = row?.last_status === 'erro' || row?.last_status === 'error';
  const hasApi = !!row?.config?.base_url;

  const buildConfig = (): HrConfig | string => {
    if (!/^https:\/\/\S+$/i.test(baseUrl.trim())) return 'O endereço do sistema precisa começar com https://.';
    if (!listPath.trim()) return 'Informe o caminho da consulta (por exemplo, o endereço que lista o ponto do dia).';
    if (!matchField.trim()) return 'Informe o campo do registro que identifica a pessoa (e-mail, CPF ou matrícula).';
    if (!fStatus.trim()) return 'Informe o campo do registro que traz a situação do ponto.';
    if (authType === 'header' && !headerName.trim()) return 'Informe o nome do cabeçalho que leva a chave.';
    const status_map: Record<string, HrStatus> = {};
    for (const r of map) { const k = r.k.trim(); if (k) status_map[k] = r.v; }
    if (!Object.keys(status_map).length) return 'Adicione pelo menos uma linha em “Situações”: o valor que o sistema envia e o status no ewvon.';
    const n = Math.min(60, Math.max(5, Number(interval) || 15));
    return {
      vendor: vendor.trim(), base_url: baseUrl.trim(), list_path: listPath.trim(), method,
      auth: { type: authType, ...(authType === 'header' ? { header_name: headerName.trim() } : {}) },
      array_path: arrayPath.trim(), match: { by: matchBy, field: matchField.trim() },
      fields: { status: fStatus.trim(), ...(fClock.trim() ? { clock_in: fClock.trim() } : {}), ...(fBank.trim() ? { bank_minutes: fBank.trim() } : {}) },
      status_map, interval_min: n,
    };
  };

  const save = async () => {
    const cfg = buildConfig();
    if (typeof cfg === 'string') { toast.error(cfg); return; }
    if (!row?.config?.base_url && !secret) { toast.error('Cole o token ou a chave de acesso do sistema de ponto.'); return; }
    setBusy('save');
    try { await call('save', { config: cfg, secret: secret || undefined, enabled }); setSecret(''); setPreview(null); toast.success('Conexão de RH salva.'); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const test = async () => {
    setBusy('test'); setPreview(null);
    try {
      const r = await call('test', {});
      setPreview({ sample: (r.sample || []) as Sample[], total: Number(r.total) || 0, matched: Number(r.matched) || 0 });
      if (!r.matched) toast.error('A consulta funcionou, mas nenhuma pessoa foi encontrada no ewvon.');
      else toast.success(`${r.matched} de ${r.total} registros casaram com pessoas do ewvon.`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const sync = async () => {
    setBusy('sync');
    try { const r = await call('sync', {}); toast.success(`Sincronizado: ${r.matched ?? 0} pessoas atualizadas${r.unmatched ? `, ${r.unmatched} sem correspondência` : ''}.`); onChanged(); }
    catch (e) { toast.error((e as Error).message); onChanged(); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!(await appConfirm({ title: 'Desconectar RH e Ponto?', message: 'A chave é apagada e o Dash 3D deixa de mostrar presença, atrasos e banco de horas.', confirmText: 'Desconectar', danger: true }))) return;
    setBusy('remove');
    try { await call('remove', {}); toast.success('RH e Ponto desconectado.'); setPreview(null); setIngest(null); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const genKey = async () => {
    if (ingest || row) {
      if (!(await appConfirm({ title: 'Gerar uma nova chave?', message: 'A chave atual (se houver) para de funcionar. Quem envia os dados precisa trocar para a nova.', confirmText: 'Gerar nova chave', danger: true }))) return;
    }
    setBusy('key');
    try { const r = await call('ingest-key', {}); setIngest({ key: String(r.key), url: String(r.url) }); toast.success('Chave gerada. Copie agora: ela não aparece de novo.'); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const lbl = 'mb-1 text-[12px] text-muted-foreground';
  const sel = 'h-9 w-full rounded-md border border-input bg-background px-2 text-[13px]';

  return (
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background"><Users className="h-5 w-5" /></span>
          <div>
            <p className="text-[15px] font-semibold">RH e Ponto (Dash 3D)</p>
            <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
              {!row ? 'Não conectado' : failed
                ? <><AlertCircle className="h-3.5 w-3.5 text-destructive" />Última sincronização falhou</>
                : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Conectado{row.config?.vendor ? ` · ${row.config.vendor}` : ''}{row.last_used_at ? ` · última sincronização ${when(row.last_used_at)}` : ' · ainda sem sincronização'}</>}
            </p>
          </div>
        </div>
        {row ? <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar" /> : null}
      </div>
      {failed && row?.last_error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{row.last_error}</p> : null}
      <p className="text-[13px] text-muted-foreground">Traz presença, atrasos, faltas e banco de horas de sistemas como <b className="text-foreground">Ahgora, Nexti, Convenia</b> e outros para o <b className="text-foreground">Dash 3D</b>. Os dados aparecem só lá (não são atalhos para esses sistemas) e as pessoas são reconhecidas pelo e-mail, CPF ou matrícula do cadastro.</p>

      <GuideDropdown title="Como configurar"><HrGuide /></GuideDropdown>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="ui-chip" aria-pressed={tab === 'api'} onClick={() => setTab('api')}>Buscar por API</button>
        <button type="button" className="ui-chip" aria-pressed={tab === 'push'} onClick={() => setTab('push')}>Receber por envio (push)</button>
      </div>

      {tab === 'api' ? (
        <div className="space-y-4">
          <div>
            <p className={lbl}>Sistema de ponto (só o nome, para identificar)</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {VENDORS.map((v) => <button key={v} type="button" className="ui-chip" aria-pressed={vendor === v} onClick={() => setVendor(v === 'Outro' ? '' : v)}>{v}</button>)}
              <Input className="h-8 max-w-[200px]" placeholder="Nome do sistema" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
          </div>
          <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">Confira a documentação do seu sistema de ponto para o endereço e os campos. O ewvon não preenche esses dados por você.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div><p className={lbl}>Endereço base da API (https)</p><Input placeholder="https://api.seu-sistema.com.br" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></div>
              <div><p className={lbl}>Método</p><select className={sel} value={method} onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}><option>GET</option><option>POST</option></select></div>
            </div>
            <div><p className={lbl}>Caminho da consulta</p><Input placeholder="/caminho/da/consulta" value={listPath} onChange={(e) => setListPath(e.target.value)} /></div>
            <div><p className={lbl}>Onde está a lista na resposta (vazio = a resposta já é a lista)</p><Input placeholder="ex.: data.items" value={arrayPath} onChange={(e) => setArrayPath(e.target.value)} /></div>
            <div>
              <p className={lbl}>Tipo de acesso</p>
              <select className={sel} value={authType} onChange={(e) => setAuthType(e.target.value as 'bearer' | 'header' | 'basic')}>{Object.entries(AUTH_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            {authType === 'header' ? <div><p className={lbl}>Nome do cabeçalho</p><Input placeholder="ex.: X-Api-Key" value={headerName} onChange={(e) => setHeaderName(e.target.value)} /></div> : <div />}
            <div className="sm:col-span-2">
              <p className={lbl}>{authType === 'basic' ? 'Usuário:senha' : 'Token ou chave de acesso'}{hasApi ? ' · já salvo, preencha só para trocar' : ''}</p>
              <Input type="password" autoComplete="off" placeholder={hasApi ? '••••••••••••' : authType === 'basic' ? 'usuario:senha' : 'Cole aqui'} value={secret} onChange={(e) => setSecret(e.target.value.trim())} />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Como reconhecer a pessoa</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className={lbl}>Identificador usado</p><select className={sel} value={matchBy} onChange={(e) => setMatchBy(e.target.value as 'email' | 'cpf' | 'registration')}>{Object.entries(BY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div><p className={lbl}>Campo do registro que traz esse dado</p><Input placeholder="ex.: employee.email" value={matchField} onChange={(e) => setMatchField(e.target.value)} /></div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Campos do registro</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className={lbl}>Situação do ponto</p><Input placeholder="campo da situação" value={fStatus} onChange={(e) => setFStatus(e.target.value)} /></div>
              <div><p className={lbl}>Horário de entrada (opcional)</p><Input placeholder="campo da entrada" value={fClock} onChange={(e) => setFClock(e.target.value)} /></div>
              <div><p className={lbl}>Banco de horas em minutos (opcional)</p><Input placeholder="campo do saldo" value={fBank} onChange={(e) => setFBank(e.target.value)} /></div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[13px] font-semibold">Situações</p>
            <p className="mb-2 text-[11.5px] text-muted-foreground">Para cada valor que o sistema envia, escolha o status correspondente no ewvon. Valores não listados são ignorados.</p>
            <div className="space-y-1.5">
              {map.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="h-9" placeholder="valor enviado pelo sistema" value={r.k} onChange={(e) => setMap(map.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                  <span className="text-muted-foreground">→</span>
                  <select className={`${sel} max-w-[150px]`} value={r.v} onChange={(e) => setMap(map.map((x, j) => (j === i ? { ...x, v: e.target.value as HrStatus } : x)))}>{(Object.keys(STATUS_LABEL) as HrStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover linha" onClick={() => setMap(map.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" className="mt-2 h-8" onClick={() => setMap([...map, { k: '', v: 'present' }])}><Plus className="mr-1.5 h-4 w-4" />Adicionar situação</Button>
          </div>

          <div className="max-w-[260px]">
            <p className={lbl}>Atualizar a cada (minutos, de 5 a 60)</p>
            <Input inputMode="numeric" value={interval} onChange={(e) => setIntervalMin(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </div>

          {preview ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-[13px] font-semibold">Prévia: {preview.matched} de {preview.total} registros casaram com pessoas do ewvon</p>
              {!preview.matched ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">Nenhum registro casou. Confira o identificador escolhido (e-mail, CPF ou matrícula) e o campo do registro: o dado precisa ser igual ao cadastro do ewvon.</p> : null}
              {preview.sample.length ? (
                <div className="divide-y divide-border text-[12.5px]">
                  {preview.sample.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-1.5">{s.matched ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}<span className="truncate">{s.identifier || '(sem identificador)'}</span></span>
                      <span className="text-muted-foreground">{s.status ? STATUS_LABEL[s.status as HrStatus] || s.status : 'situação não mapeada'}{s.clock_in ? ` · entrada ${when(s.clock_in)}` : ''} · banco {fmtBank(s.bank_minutes)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-9" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{hasApi ? 'Salvar alterações' : 'Salvar'}</Button>
            {hasApi ? <Button size="sm" variant="outline" className="h-9" onClick={() => void test()} disabled={busy !== null}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Testar conexão</Button> : null}
            {hasApi ? <Button size="sm" variant="outline" className="h-9" onClick={() => void sync()} disabled={busy !== null}>{busy === 'sync' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar agora</Button> : null}
            {row ? <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={() => void remove()} disabled={busy !== null}><Trash2 className="mr-2 h-4 w-4" />Desconectar</Button> : null}
          </div>
          {hasApi ? <p className="text-[11px] text-muted-foreground">“Testar conexão” e “Sincronizar agora” usam o que está salvo: salve as alterações antes.</p> : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">Se o seu sistema de ponto sabe enviar dados (webhook, integração ou um script), ele manda a situação das pessoas para o ewvon com a chave da empresa. Gere a chave abaixo e entregue ao responsável pela integração.</p>
          <Button size="sm" className="h-9" onClick={() => void genKey()} disabled={busy !== null}>{busy === 'key' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Gerar chave de ingestão</Button>
          {ingest ? (
            <div className="space-y-2 rounded-lg border border-border p-3 text-[12.5px]">
              <p className="font-semibold text-destructive">Copie a chave agora. Ela é mostrada uma única vez.</p>
              <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1">{ingest.key}</code><Button type="button" size="sm" variant="outline" className="h-8" onClick={() => copy(ingest.key, 'Chave')}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button></div>
              <p className="text-muted-foreground">Endereço de envio (POST)</p>
              <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1">{ingest.url}</code><Button type="button" size="sm" variant="outline" className="h-8" onClick={() => copy(ingest.url, 'Endereço')}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button></div>
            </div>
          ) : <p className="text-[12px] text-muted-foreground">O endereço de envio aparece junto com a chave, ao gerá-la.</p>}
          <div>
            <p className="mb-1 text-[13px] font-semibold">Formato do envio</p>
            <p className="mb-1.5 text-[12px] text-muted-foreground">POST no endereço acima, com o cabeçalho <code>x-ewvon-key: &lt;chave&gt;</code> e o corpo abaixo. Em cada registro, use <code>email</code>, <code>cpf</code> ou <code>registration</code> (matrícula). Status aceitos: present, late, absent, vacation, leave, off.</p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[12px]">{EXAMPLE}</pre>
              <Button type="button" size="sm" variant="outline" className="absolute right-2 top-2 h-7" onClick={() => copy(EXAMPLE, 'Exemplo')}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar</Button>
            </div>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}
