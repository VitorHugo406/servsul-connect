// Company admin: bring attendance data (presence, delays, absences, hours bank) from a third-party HR / time-clock system into the Dash 3D.
// Data only feeds the Dash. The secret goes straight to the `hr-sync` edge function (encrypted there); this screen never reads it back.
import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Trash2, CheckCircle2, AlertCircle, RefreshCw, PlugZap, Copy, KeyRound, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { toast } from 'sonner';
import { GuideDropdown, HrGuide } from '@/components/integrations/IntegrationGuides';

type Preset = { id: string; name: string; cat: string; needsUrl?: boolean; auth: 'header' | 'bearer' | 'basic' | 'oauth'; header?: string; tokenLabel?: string; note?: string; url?: string; path?: string };
export type HrRow = { enabled: boolean; config: { preset?: string; url?: string; path?: string; auth?: string; header?: string; oauth_url?: string; every?: number } | null; last_status: string | null; last_error: string | null; last_used_at: string | null };
type Load = { total?: number; matched?: number; unmatched?: number; dismissed?: number; columns?: string[] };
type Test = Load & { active?: number; sample?: { name: string; matched: boolean; depto?: string | null; status?: string | null }[] };

const STATUS_LABEL: Record<string, string> = { present: 'Presente', late: 'Atrasado', absent: 'Falta', vacation: 'Férias', leave: 'Afastado', off: 'Folga' };

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

function ago(v: string | null | undefined) {
  if (!v) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000));
  if (m < 1) return 'agora há pouco';
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.floor(m / 60)} h`;
  return `há ${Math.floor(m / 1440)} d`;
}

function copy(text: string, what: string) {
  try { void navigator.clipboard.writeText(text).then(() => toast.success(`${what} copiado.`), () => toast.error('Não foi possível copiar.')); }
  catch { toast.error('Não foi possível copiar.'); }
}

export function HrCard({ row, onChanged }: { row?: HrRow; onChanged: () => void }) {
  const c = row?.config ?? {};
  const [tab, setTab] = useState<'api' | 'push'>('api');
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [presetErr, setPresetErr] = useState('');
  const [enabled, setEnabled] = useState(row?.enabled ?? true);
  const [presetId, setPresetId] = useState(c.preset ?? '');
  const [q, setQ] = useState('');
  const [secret, setSecret] = useState('');
  const [url, setUrl] = useState(c.url ?? '');
  const [path, setPath] = useState(c.path ?? '');
  const [headerName, setHeaderName] = useState(c.header ?? '');
  const [oauthUrl, setOauthUrl] = useState(c.oauth_url ?? '');
  const [every, setEvery] = useState(String(c.every ?? 1));
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Load | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [test, setTest] = useState<Test | null>(null);
  const [ingest, setIngest] = useState<{ key: string; url: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(t); }, []);

  const loadPresets = async () => {
    setPresetErr('');
    try { const r = await call('presets', {}); setPresets((r.presets || []) as Preset[]); }
    catch (e) { setPresets(null); setPresetErr((e as Error).message); }
  };
  useEffect(() => { void loadPresets(); }, []);

  const preset = presets?.find((p) => p.id === presetId);
  // Picking a system pre-fills its address/path (editable under "Opções avançadas").
  const choose = (p: Preset) => {
    setPresetId(p.id); setUrl(p.url ?? ''); setPath(p.path ?? ''); setHeaderName(p.header ?? ''); setOauthUrl(''); setLoaded(null); setTest(null); setLoadErr('');
  };
  useEffect(() => {
    const k = row?.config ?? {};
    setEnabled(row?.enabled ?? true); setPresetId(k.preset ?? ''); setUrl(k.url ?? ''); setPath(k.path ?? ''); setHeaderName(k.header ?? ''); setOauthUrl(k.oauth_url ?? ''); setEvery(String(k.every ?? 1));
  }, [row]);

  const connected = !!row?.config?.preset;
  const failed = row?.last_status === 'erro' || row?.last_status === 'error';
  const keyLabel = preset?.auth === 'oauth' ? 'Client ID:Secret' : preset?.tokenLabel || 'Chave de acesso';

  const body = () => {
    const n = Math.min(60, Math.max(1, Number(every) || 1));
    return { preset: presetId, url: url.trim() || undefined, path: path.trim() || undefined, header_name: preset?.auth === 'header' ? headerName.trim() || undefined : undefined, oauth_url: preset?.auth === 'oauth' ? oauthUrl.trim() || undefined : undefined, every: n, secret: secret || undefined, enabled };
  };
  const check = (): string | null => {
    if (!presetId) return 'Escolha o sistema de ponto ou de gestão de pessoas.';
    if (!connected && !secret) return 'Cole a chave de acesso do sistema.';
    if (preset?.needsUrl && !/^https:\/\/\S+$/i.test(url.trim())) return 'Informe o endereço da API (começa com https://) em Opções avançadas.';
    if (preset?.auth === 'oauth' && !oauthUrl.trim()) return 'Informe o endereço do login/token em Opções avançadas.';
    return null;
  };

  const save = async () => {
    const err = check(); if (err) { toast.error(err); return; }
    setBusy('save'); setLoaded(null); setLoadErr(''); setTest(null);
    try {
      const r = await call('save', body()); setSecret('');
      if (r.first?.error) { setLoadErr(String(r.first.error)); toast.error('Chave salva, mas a primeira carga falhou.'); }
      else { setLoaded((r.first || {}) as Load); toast.success('Conectado. Dados carregados no Dash 3D.'); }
      onChanged();
    } catch (e) { setLoadErr((e as Error).message); toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const runTest = async () => {
    const err = check(); if (err) { toast.error(err); return; }
    setBusy('test'); setTest(null); setLoadErr('');
    try { const r = (await call('test', body())) as Test; setTest(r); if (!r.matched) toast.error('A consulta funcionou, mas nenhuma pessoa foi reconhecida.'); else toast.success(`${r.matched} de ${r.total} pessoas reconhecidas.`); }
    catch (e) { setLoadErr((e as Error).message); toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const sync = async () => {
    setBusy('sync'); setLoadErr('');
    try { const r = await call('sync', {}); setLoaded(r as Load); toast.success(`Atualizado: ${r.matched ?? 0} pessoas.`); onChanged(); }
    catch (e) { setLoadErr((e as Error).message); toast.error((e as Error).message); onChanged(); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!(await appConfirm({ title: 'Desconectar RH e Ponto?', message: 'A chave é apagada e o Dash 3D deixa de mostrar presença, atrasos e banco de horas.', confirmText: 'Desconectar', danger: true }))) return;
    setBusy('remove');
    try { await call('remove', {}); toast.success('RH e Ponto desconectado.'); setLoaded(null); setTest(null); setIngest(null); setPresetId(''); onChanged(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const genKey = async () => {
    if (!(await appConfirm({ title: 'Gerar uma nova chave?', message: 'A chave atual (se houver) para de funcionar. Quem envia os dados precisa trocar para a nova.', confirmText: 'Gerar chave', danger: true }))) return;
    setBusy('key');
    try { const r = await call('ingest-key', {}); setIngest({ key: String(r.key), url: String(r.url) }); toast.success('Chave gerada. Copie agora: ela não aparece de novo.'); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = new Map<string, Preset[]>();
    (presets || []).filter((p) => !needle || p.name.toLowerCase().includes(needle)).forEach((p) => m.set(p.cat, [...(m.get(p.cat) || []), p]));
    return [...m.entries()];
  }, [presets, q]);

  const lbl = 'mb-1 text-[12px] text-muted-foreground';
  const Result = ({ r }: { r: Load }) => (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-[13px] font-semibold">{r.matched ?? 0} de {r.total ?? 0} pessoas reconhecidas</p>
      {r.columns?.length ? <div className="flex flex-wrap gap-1.5">{r.columns.map((x) => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{x}</span>)}</div> : null}
      {!r.matched ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">Ninguém foi reconhecido. O cadastro do ewvon precisa ter o mesmo e-mail, CPF, matrícula ou nome que o sistema de ponto.</p>
        : r.unmatched ? <p className="text-[12px] text-muted-foreground">{r.unmatched} registros não foram reconhecidos. Para entrarem, o cadastro do ewvon precisa ter o mesmo e-mail, CPF, matrícula ou nome que o sistema de ponto.</p> : null}
    </div>
  );

  return (
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background"><Users className="h-5 w-5" /></span>
          <div>
            <p className="text-[15px] font-semibold">RH e Ponto (Dash 3D)</p>
            <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
              {!row ? 'Não conectado' : failed
                ? <><AlertCircle className="h-3.5 w-3.5 text-destructive" />Última atualização falhou</>
                : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Conectado{preset ? ` · ${preset.name}` : ''}{row.last_used_at ? ` · última atualização ${ago(row.last_used_at)}` : ' · ainda sem atualização'}</>}
            </p>
          </div>
        </div>
        {row ? <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar" /> : null}
      </div>
      {failed && row?.last_error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{row.last_error}</p> : null}
      <p className="text-[13px] text-muted-foreground">Escolha o seu sistema, cole só a chave e pronto: presença, atrasos, faltas, horas extras e banco de horas de sistemas como <b className="text-foreground">Convenia, Pontomais, Tangerino, Ahgora, Nexti</b> e outros vão para o <b className="text-foreground">Dash 3D</b>. As colunas são reconhecidas automaticamente. Os dados aparecem só lá (não são atalhos).</p>

      <GuideDropdown title="Como configurar"><HrGuide /></GuideDropdown>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="ui-chip" aria-pressed={tab === 'api'} onClick={() => setTab('api')}>Buscar por API</button>
        <button type="button" className="ui-chip" aria-pressed={tab === 'push'} onClick={() => setTab('push')}>Receber por envio (push)</button>
      </div>

      {tab === 'api' ? (
        <div className="space-y-4">
          <div>
            <p className={lbl}>1. Sistema</p>
            {presetErr ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{presetErr}<Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void loadPresets()}>Tentar de novo</Button></div>
            ) : !presets ? <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando sistemas…</div> : (
              <div className="space-y-2">
                <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-8" placeholder="Buscar sistema" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-lg border border-border p-2.5">
                  {groups.length ? groups.map(([cat, list]) => (
                    <div key={cat}>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                      <div className="flex flex-wrap gap-1.5">{list.map((p) => <button key={p.id} type="button" className="ui-chip" aria-pressed={presetId === p.id} onClick={() => choose(p)}>{p.name}</button>)}</div>
                    </div>
                  )) : <p className="text-[12px] text-muted-foreground">Nenhum sistema com esse nome. Use “Qualquer API” ou “Seu sistema”.</p>}
                </div>
                {preset?.note ? <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">{preset.note}</p> : null}
              </div>
            )}
          </div>

          <div>
            <p className={lbl}>2. {keyLabel}{connected ? ' · já salva, preencha só para trocar' : ''}</p>
            <Input type="password" autoComplete="off" placeholder={connected ? '••••••••••••' : 'Cole aqui'} value={secret} onChange={(e) => setSecret(e.target.value.trim())} />
            <p className="mt-1 text-[11px] text-muted-foreground">Atualiza a cada {Math.min(60, Math.max(1, Number(every) || 1)) === 1 ? '1 minuto' : `${Math.min(60, Math.max(1, Number(every) || 1))} minutos`}. A chave é guardada criptografada e nunca mais aparece.</p>
          </div>

          <details className="group rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">Opções avançadas</summary>
            <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><p className={lbl}>Endereço da API (https){preset?.needsUrl ? ' · obrigatório' : ''}</p><Input placeholder="https://api.seu-sistema.com.br" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
              <div><p className={lbl}>Caminho da lista</p><Input placeholder="/caminho/da/lista" value={path} onChange={(e) => setPath(e.target.value)} /></div>
              <div><p className={lbl}>Atualizar a cada (minutos, 1 a 60)</p><Input inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div>
              {preset?.auth === 'header' ? <div><p className={lbl}>Nome do cabeçalho da chave</p><Input placeholder="ex.: X-Api-Key" value={headerName} onChange={(e) => setHeaderName(e.target.value)} /></div> : null}
              {preset?.auth === 'oauth' ? <div className="sm:col-span-2"><p className={lbl}>Endereço do login/token (obrigatório)</p><Input placeholder="https://…/oauth/token" value={oauthUrl} onChange={(e) => setOauthUrl(e.target.value)} /></div> : null}
            </div>
          </details>

          {loadErr ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{loadErr}</p> : null}
          {loaded ? <Result r={loaded} /> : null}
          {test ? (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-muted-foreground">Prévia do teste (nada foi salvo){test.active != null ? ` · ${test.active} ativos` : ''}</p>
              <Result r={test} />
              {test.sample?.length ? (
                <div className="divide-y divide-border rounded-lg border border-border px-3 text-[12.5px]">
                  {test.sample.map((x, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-1.5">{x.matched ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}<span className="truncate">{x.name}</span></span>
                      <span className="text-muted-foreground">{[x.depto, x.status ? STATUS_LABEL[x.status] || x.status : null].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-9" onClick={() => void save()} disabled={busy !== null || !presets}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{connected ? 'Salvar e recarregar' : 'Conectar e carregar'}</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => void runTest()} disabled={busy !== null || !presets}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Testar conexão</Button>
            {connected ? <Button size="sm" variant="outline" className="h-9" onClick={() => void sync()} disabled={busy !== null}>{busy === 'sync' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Sincronizar agora</Button> : null}
            {row ? <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={() => void remove()} disabled={busy !== null}><Trash2 className="mr-2 h-4 w-4" />Desconectar</Button> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">Se o seu sistema sabe enviar dados (webhook, integração ou script), ele manda a situação das pessoas para o ewvon com a chave da empresa. Gere a chave abaixo e entregue ao responsável pela integração.</p>
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
            <p className="mb-1.5 text-[12px] text-muted-foreground">POST no endereço acima, com o cabeçalho <code>x-ewvon-key: &lt;chave&gt;</code>. Identifique a pessoa por <code>email</code>, <code>cpf</code>, <code>registration</code> (matrícula) ou <code>name</code>. Opcionais: status (present, late, absent, vacation, leave, off), clock_in, hours_bank_minutes, depto, cargo, faltas, he, atr, bat, fv.</p>
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
