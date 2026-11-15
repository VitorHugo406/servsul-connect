// Company admin: connect HR / people-management systems (Convenia, Pontomais, Ahgora, Nexti…). The Dash 3D then uses THEIR employees
// (admissions, salaries, dismissals, roles, departments…) for its metrics. No time-clock data is imported. Several systems can be connected.
// The secret goes straight to the `hr-sync` edge function (encrypted there); this screen never reads it back.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Trash2, CheckCircle2, AlertCircle, RefreshCw, PlugZap, Plus, Pencil, Search, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { appConfirm } from '@/lib/appDialog';
import { toast } from 'sonner';
import { BrandDot, BrandTile } from '@/components/integrations/BrandMark';
import { HR_PRESETS } from '@/lib/hrPresets';
import { GuideDropdown, HrGuide } from '@/components/integrations/IntegrationGuides';

type Preset = { id: string; name: string; cat: string; needsUrl?: boolean; auth: 'header' | 'bearer' | 'basic' | 'oauth'; header?: string; tokenLabel?: string; note?: string; url?: string; path?: string };
type Source = { id: string; label: string | null; preset: string; config: { preset?: string; url?: string; path?: string; header?: string; oauth_url?: string; every?: number } | null; enabled: boolean; last_status: string | null; last_error: string | null; last_used_at: string | null; last_count: number | null };
type Result = { total?: number; columns?: string[]; missing?: string[]; active?: number; dismissed?: number; sample?: { name: string; depto?: string | null; cargo?: string | null; adm?: string | null }[]; error?: string };

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

type ImpPreview = { total: number; dismissed: number; withoutEmail: number; alreadyRegistered: number; eligible: number; limit: number | null; used: number; seats: number | null; willImport: number; over: boolean; excluded: number; firstName: string | null; lastName: string | null; firstExcluded: string | null; fields: number };
type ImpDone = { created: number; failed: number; newSectors: number; limitHit: boolean; errors: string[] };

/** Create ewvon users from the people of a connected system: counts first, asks when the plan has fewer seats than people. */
function ImportPanel({ source, name, onClose }: { source: Source; name: string; onClose: () => void }) {
  const [pv, setPv] = useState<ImpPreview | null>(null);
  const [err, setErr] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<ImpDone | null>(null);
  useEffect(() => { let alive = true; call('import-preview', { id: source.id }).then((r) => alive && setPv(r as ImpPreview)).catch((e) => alive && setErr((e as Error).message)); return () => { alive = false; }; }, [source.id]);

  const start = async () => {
    if (!pv) return;
    setRunning(true); setProgress(0);
    const acc: ImpDone = { created: 0, failed: 0, newSectors: 0, limitHit: false, errors: [] };
    try {
      for (let i = 0; i < 40; i++) {
        const r = await call('import-run', { id: source.id, mode: 'all' });
        acc.created += r.created || 0; acc.failed += r.failed || 0; acc.newSectors += r.newSectors || 0; acc.limitHit = acc.limitHit || !!r.limitHit; acc.errors.push(...(r.errors || []));
        setProgress(acc.created);
        if (!r.pending || (!r.created && !r.failed)) break;
      }
      setDone(acc);
    } catch (e) { setErr((e as Error).message); if (acc.created) setDone(acc); }
    finally { setRunning(false); }
  };

  const box = 'space-y-3 rounded-xl border border-border p-3 text-[13px]';
  if (done) return (
    <div className={box}>
      <p className="font-semibold">Importação concluída</p>
      <p>{done.created} colaborador(es) criado(s){done.newSectors ? `, ${done.newSectors} setor(es) novo(s)` : ''}{done.failed ? `, ${done.failed} com falha` : ''}.{done.limitHit ? ' O limite do plano foi atingido e o restante não foi importado.' : ''}</p>
      {done.errors.length ? <ul className="list-disc pl-5 text-[12px] text-muted-foreground">{done.errors.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
      <p className="text-[12px] text-muted-foreground">Cada pessoa recebeu uma senha aleatória que ninguém conhece: ela entra pelo e-mail cadastrado usando “Esqueci minha senha”, ou você define a senha em Gerenciamento.</p>
      <button className="dk-btn" type="button" onClick={onClose}>Fechar</button>
    </div>
  );
  return (
    <div className={box}>
      <p className="font-semibold">Importar colaboradores de {name}</p>
      {err ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{err}</p> : null}
      {!pv && !err ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Consultando o sistema e o limite do plano…</p> : null}
      {pv ? (
        <>
          <p>O sistema tem <b>{pv.total}</b> pessoa(s): {pv.total - pv.dismissed} ativa(s){pv.dismissed ? `, ${pv.dismissed} desligada(s) (não são importadas)` : ''}.
            {pv.withoutEmail ? ` ${pv.withoutEmail} sem e-mail válido (não dá para criar o acesso).` : ''}{pv.alreadyRegistered ? ` ${pv.alreadyRegistered} já têm cadastro no ewvon.` : ''} <b>{pv.eligible}</b> podem ser criadas.</p>
          <p className="text-muted-foreground">{pv.limit == null ? 'Sua empresa não tem limite de usuários: todos serão importados.' : `Seu plano permite ${pv.limit} usuário(s) ativo(s); hoje há ${pv.used}, restam ${pv.seats}.`} São importados nome, e-mail, telefone, nascimento, setor (criado se não existir), matrícula e tudo que o sistema enviar da ficha (cargo, admissão, salário, documentos, endereço, contrato, jornada…).</p>
          {pv.over ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px]">Há mais pessoas do que o plano comporta. A importação segue a <b>ordem alfabética</b> pelo nome: dá para importar <b>{pv.willImport}</b> ({pv.firstName} … {pv.lastName}) e ficam de fora {pv.excluded}, a partir de {pv.firstExcluded}. Escolha importar essa quantidade ou não importar nada (você também pode comprar usuários extras em Pagamentos e tentar de novo).</p>
          ) : null}
          {pv.willImport === 0 ? <p className="text-muted-foreground">Não há ninguém para importar agora.</p> : null}
          {running ? <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Criando usuários… {progress} de {pv.willImport}</p> : null}
          <div className="flex flex-wrap gap-2">
            {pv.willImport > 0 ? <button className="dk-btn pri" type="button" disabled={running} onClick={() => void start()}>{pv.over ? `Importar ${pv.willImport} (ordem alfabética)` : `Importar ${pv.willImport} colaborador(es)`}</button> : null}
            <button className="dk-btn" type="button" disabled={running} onClick={onClose}>{pv.over ? 'Não importar nenhum' : 'Cancelar'}</button>
          </div>
        </>
      ) : <button className="dk-btn" type="button" onClick={onClose}>Fechar</button>}
    </div>
  );
}

function SourceForm({ presets, source, onChanged, onClose }: { presets: Preset[]; source?: Source; onChanged: () => void; onClose: () => void }) {
  const c = source?.config ?? {};
  const [presetId, setPresetId] = useState(source?.preset ?? c.preset ?? '');
  const [label, setLabel] = useState(source?.label ?? '');
  const [q, setQ] = useState('');
  const [secret, setSecret] = useState('');
  const [url, setUrl] = useState(c.url ?? '');
  const [path, setPath] = useState(c.path ?? '');
  const [headerName, setHeaderName] = useState(c.header ?? '');
  const [oauthUrl, setOauthUrl] = useState(c.oauth_url ?? '');
  const [every, setEvery] = useState(String(c.every ?? 1));
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<{ kind: 'save' | 'test'; r: Result } | null>(null);

  const preset = presets.find((p) => p.id === presetId);
  const choose = (p: Preset) => { setPresetId(p.id); setUrl(p.url ?? ''); setPath(p.path ?? ''); setHeaderName(p.header ?? ''); setOauthUrl(''); setRes(null); };
  const keyLabel = preset?.auth === 'oauth' ? 'Client ID:Secret' : preset?.tokenLabel || 'Chave de acesso';
  const everyN = Math.min(60, Math.max(1, Number(every) || 1));

  const body = () => ({
    id: source?.id, label: label.trim() || undefined, preset: presetId, url: url.trim() || undefined, path: path.trim() || undefined,
    header_name: preset?.auth === 'header' ? headerName.trim() || undefined : undefined, oauth_url: preset?.auth === 'oauth' ? oauthUrl.trim() || undefined : undefined,
    every: everyN, secret: secret || undefined, enabled: source?.enabled ?? true,
  });
  const check = (): string | null => {
    if (!presetId) return 'Escolha o sistema de gestão de pessoas.';
    if (!source && !secret) return 'Cole a chave de acesso do sistema.';
    if (preset?.needsUrl && !/^https:\/\/\S+$/i.test(url.trim())) return 'Informe o endereço da API (começa com https://) em Opções avançadas.';
    if (preset?.auth === 'oauth' && !oauthUrl.trim()) return 'Informe o endereço do login/token em Opções avançadas.';
    return null;
  };
  const save = async () => {
    const err = check(); if (err) { toast.error(err); return; }
    setBusy('save'); setRes(null);
    try {
      const r = await call('save', body()); setSecret('');
      if (r.first?.error) { setRes({ kind: 'save', r: { error: String(r.first.error) } }); toast.error('Sistema salvo, mas a primeira carga falhou.'); }
      else { setRes({ kind: 'save', r: (r.first || {}) as Result }); toast.success('Conectado. Colaboradores carregados.'); }
      onChanged();
    } catch (e) { setRes({ kind: 'save', r: { error: (e as Error).message } }); toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const runTest = async () => {
    const err = check(); if (err) { toast.error(err); return; }
    setBusy('test'); setRes(null);
    try { setRes({ kind: 'test', r: (await call('test', body())) as Result }); }
    catch (e) { setRes({ kind: 'test', r: { error: (e as Error).message } }); toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = new Map<string, Preset[]>();
    presets.filter((p) => !needle || p.name.toLowerCase().includes(needle)).forEach((p) => m.set(p.cat, [...(m.get(p.cat) || []), p]));
    return [...m.entries()];
  }, [presets, q]);
  const lbl = 'mb-1 text-[12px] text-muted-foreground';

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <p className="text-[14px] font-semibold">{source ? 'Editar sistema' : 'Adicionar sistema'}</p>
      <div>
        <p className={lbl}>1. Sistema</p>
        <div className="space-y-2">
          <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-10 !pl-10" placeholder="Buscar sistema" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-lg border border-border p-2.5">
            {groups.length ? groups.map(([cat, list]) => (
              <div key={cat}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                <div className="flex flex-wrap gap-1.5">{list.map((p) => <button key={p.id} type="button" className="ui-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }} aria-pressed={presetId === p.id} onClick={() => choose(p)}><BrandDot id={p.id} name={p.name} />{p.name}</button>)}</div>
              </div>
            )) : <p className="text-[12px] text-muted-foreground">Nenhum sistema com esse nome. Use “Qualquer API” ou “Seu sistema”.</p>}
          </div>
          {preset?.note ? <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">{preset.note}</p> : null}
        </div>
      </div>
      <div>
        <p className={lbl}>2. {keyLabel}{source ? ' · já salva, deixe em branco para manter' : ''}</p>
        <Input type="password" autoComplete="off" placeholder={source ? '••••••••••••' : 'Cole aqui'} value={secret} onChange={(e) => setSecret(e.target.value.trim())} />
        <p className="mt-1 text-[11px] text-muted-foreground">Atualiza a cada {everyN === 1 ? '1 minuto' : `${everyN} minutos`}. A chave é guardada criptografada e nunca mais aparece.</p>
      </div>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">Opções avançadas</summary>
        <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><p className={lbl}>Nome para identificar (opcional)</p><Input placeholder="ex.: Matriz, Filial Sul" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="sm:col-span-2"><p className={lbl}>Endereço da API (https){preset?.needsUrl ? ' · obrigatório' : ''}</p><Input placeholder="https://api.seu-sistema.com.br" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div><p className={lbl}>Caminho da lista</p><Input placeholder="/caminho/da/lista" value={path} onChange={(e) => setPath(e.target.value)} /></div>
          <div><p className={lbl}>Atualizar a cada (minutos, 1 a 60)</p><Input inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div>
          {preset?.auth === 'header' ? <div><p className={lbl}>Nome do cabeçalho da chave</p><Input placeholder="ex.: X-Api-Key" value={headerName} onChange={(e) => setHeaderName(e.target.value)} /></div> : null}
          {preset?.auth === 'oauth' ? <div className="sm:col-span-2"><p className={lbl}>Endereço do login/token (obrigatório)</p><Input placeholder="https://…/oauth/token" value={oauthUrl} onChange={(e) => setOauthUrl(e.target.value)} /></div> : null}
        </div>
      </details>

      {res ? (
        res.r.error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{res.r.error}</p> : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-[13px] font-semibold">{res.kind === 'test' ? 'Prévia (nada foi salvo): ' : ''}{res.r.total ?? 0} colaboradores{res.r.active != null ? ` (${res.r.active} ativos${res.r.dismissed ? `, ${res.r.dismissed} desligados` : ''})` : ''}</p>
            {res.r.columns?.length ? <div className="flex flex-wrap gap-1.5">{res.r.columns.map((x) => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{x}</span>)}</div> : null}
            {res.r.missing?.length ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">Colunas não encontradas: {res.r.missing.join(', ')}. As métricas que dependem delas ficam vazias no Dash.</p> : null}
            {!res.r.total ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">Nenhum colaborador veio. Confira a chave, o endereço e o caminho da lista.</p> : null}
            {res.r.sample?.length ? (
              <div className="divide-y divide-border rounded-lg border border-border px-3 text-[12.5px]">
                {res.r.sample.map((x, i) => <div key={i} className="flex flex-wrap justify-between gap-2 py-1.5"><span className="truncate">{x.name}</span><span className="text-muted-foreground">{[x.depto, x.cargo, x.adm].filter(Boolean).join(' · ') || '—'}</span></div>)}
              </div>
            ) : null}
          </div>
        )
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button className="dk-btn pri" type="button" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{source ? 'Salvar e recarregar' : 'Conectar e carregar'}</button>
        <button className="dk-btn" type="button" onClick={() => void runTest()} disabled={busy !== null}>{busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}Testar conexão</button>
        <button className="dk-btn" type="button" onClick={onClose} disabled={busy !== null}>{res?.kind === 'save' && !res.r.error ? 'Fechar' : 'Cancelar'}</button>
      </div>
    </div>
  );
}

export function HrCard({ view = 'sistema' }: { view?: 'sistema' | 'dash' }) {
  const isDash = view === 'dash';
  const [sources, setSources] = useState<Source[] | null>(null);
  const [listErr, setListErr] = useState('');
  const [presetsSrv, setPresets] = useState<Preset[] | null>(null);
  const presets: Preset[] = presetsSrv ?? (HR_PRESETS as Preset[]);
  const [presetErr, setPresetErr] = useState('');
  const [form, setForm] = useState<'new' | string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(t); }, []);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).from('hr_sources').select('id,label,preset,config,enabled,last_status,last_error,last_used_at,last_count').order('created_at');
    if (error) { setListErr(error.message || 'Não foi possível carregar os sistemas.'); return; }
    setListErr(''); setSources((data || []) as Source[]);
  }, []);
  const loadPresets = useCallback(async () => {
    setPresetErr('');
    try { const r = await call('presets', {}); setPresets((r.presets || []) as Preset[]); }
    catch (e) { setPresets(null); setPresetErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); void loadPresets(); const t = window.setInterval(() => void load(), 60000); return () => window.clearInterval(t); }, [load, loadPresets]);

  const nameOf = (s: Source) => presets?.find((p) => p.id === s.preset)?.name || s.preset;
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast.error((e as Error).message); await load(); } finally { setBusy(null); } };
  const sync = (s: Source) => run('sync' + s.id, async () => { const r = await call('sync', { id: s.id }); toast.success(`Atualizado: ${r.total ?? 0} colaboradores.`); await load(); });
  const toggle = (s: Source, on: boolean) => run('tg' + s.id, async () => { await call('toggle', { id: s.id, enabled: on }); await load(); });
  const remove = async (s: Source) => {
    if (!(await appConfirm({ title: `Remover ${s.label || nameOf(s)}?`, message: 'A chave e os colaboradores importados deste sistema são apagados e o Dash 3D deixa de usá-los.', confirmText: 'Remover', danger: true }))) return;
    await run('rm' + s.id, async () => { await call('remove', { id: s.id }); toast.success('Sistema removido.'); setForm(null); await load(); });
  };

  const editing = form && form !== 'new' ? sources?.find((s) => s.id === form) : undefined;

  const openNew = () => setForm('new');
  const canAdd = !!sources && sources.length < 6 && form === null;
  const icon = 'dk-ic bg';

  return (
    <div className="dk-panel dk-pad">
      <div className="dk-hd">
        <span className="dk-tile" style={{ background: '#171A21' }}><Users className="h-5 w-5" /></span>
        <div>
          <h2>{isDash ? 'Dash 3D' : 'Sistema de RH'}</h2>
          <span className={`dk-stt${sources && sources.length ? ' on' : ''}`}>{sources === null ? 'Carregando…' : sources.length ? `${sources.length} sistema(s) conectado(s)` : 'Nenhum sistema conectado'}</span>
        </div>
        {canAdd ? <button className="dk-btn pri dk-sp" type="button" onClick={openNew}><Plus className="h-4 w-4" />Adicionar sistema</button> : null}
      </div>
      <p className="dk-tx">{isDash
        ? <>Os colaboradores dos sistemas ligados abaixo alimentam o <b>Dash 3D</b> (admissões, salários, cargos, departamentos…), no lugar dos cadastrados no ewvon.</>
        : <>Conecte o sistema de gestão de pessoas (Convenia, Senior, Pontomais e outros) para <b>criar os usuários automaticamente</b>. Se o plano tiver menos vagas que pessoas, a importação segue a ordem alfabética e pergunta antes.</>}</p>

      {listErr ? <div className="dk-err">{listErr}</div> : null}
      {sources === null && !listErr ? <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null}

      {sources?.length ? (
        <div className="flex flex-col" style={{ background: '#F6F7F9', borderRadius: 16 }}>
          {sources.map((s, i) => {
            const failed = s.last_status === 'erro';
            return (
              <div key={s.id} className="space-y-2" style={{ padding: '14px 18px', borderTop: i ? '1px solid #E1E5EB' : 0 }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BrandTile id={s.preset} name={nameOf(s)} size={40} />
                    <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{s.label || nameOf(s)}</p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                      {failed ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      {s.last_count ?? 0} colaboradores · {s.last_used_at ? `atualizado ${ago(s.last_used_at)}` : 'ainda sem atualização'}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDash ? <label className="mr-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">Usar no Dash<Switch checked={s.enabled} disabled={busy !== null} onCheckedChange={(on) => void toggle(s, on)} aria-label="Usar no Dash" /></label> : null}
                    {!isDash ? <button className="dk-btn pri" type="button" onClick={() => setImporting(importing === s.id ? null : s.id)} disabled={busy !== null || failed}><UserPlus className="h-4 w-4" />Importar colaboradores</button> : null}
                    <button className={icon} type="button" title="Sincronizar agora" aria-label="Sincronizar agora" onClick={() => void sync(s)} disabled={busy !== null}>{busy === 'sync' + s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>
                    <button className={icon} type="button" title="Editar" aria-label="Editar" onClick={() => setForm(s.id)} disabled={busy !== null}><Pencil className="h-4 w-4" /></button>
                    <button className={icon} style={{ color: '#8E1B10' }} type="button" title="Remover" aria-label="Remover" onClick={() => void remove(s)} disabled={busy !== null}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {failed && s.last_error ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{s.last_error}</p> : null}
                {!failed && s.last_error ? <p className="text-[12px] text-muted-foreground">{s.last_error}</p> : null}
                {!isDash && importing === s.id ? <ImportPanel source={s} name={s.label || nameOf(s)} onClose={() => { setImporting(null); void load(); }} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {form !== null ? <SourceForm key={form} presets={presets} source={editing} onChanged={() => void load()} onClose={() => setForm(null)} /> : null}

      <GuideDropdown title="Como configurar"><HrGuide /></GuideDropdown>
      {isDash ? <p className="dk-priv">Salários, demissões e demais dados ficam visíveis só para administradores e para quem tem acesso ao Dash.</p> : null}
    </div>
  );
}
