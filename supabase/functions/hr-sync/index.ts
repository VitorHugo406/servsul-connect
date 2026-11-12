// RH e Ponto -> Dash 3D. A company connects the API of its people / time-clock system (Ahgora, Nexti, Convenia, Pontotel,
// anything REST) with a mapping, or the system pushes records to us. One status per person ends up in hr_people_status.
//   POST /hr-sync/save        company admin: { config, secret?, enabled }
//   POST /hr-sync/test        company admin: one call, mapped preview, nothing is stored
//   POST /hr-sync/sync        company admin: sync now
//   POST /hr-sync/remove      company admin: disconnect and clear the data
//   POST /hr-sync/ingest-key  company admin: new push key (shown once)
//   POST /hr-sync/ingest      third-party system: header x-ewvon-key, body { records: [...] }
//   POST /hr-sync/cron        database (Vault secret header): syncs the connectors that are due
// A failure of the third-party API is reported as a failure: it never turns into "everybody present".
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const STATUSES = ['present', 'late', 'absent', 'vacation', 'leave', 'off'] as const;
type Status = typeof STATUSES[number];
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: ArrayBuffer) => [...new Uint8Array(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

let keyP: Promise<CryptoKey> | null = null;
const key = () => (keyP ??= (async () => {
  const base = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ewvon-integrations'), info: enc.encode('secret-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
})());
async function seal(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), enc.encode(plain)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return 'v1:' + b64(out);
}
async function open(stored: string) {
  const raw = unb64(stored.replace(/^v1:/, ''));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await key(), raw.slice(12)));
}

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ewvon-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

async function companyAdmin(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
  if (!u?.user) return null;
  const [{ data: prof }, { data: roles }] = await Promise.all([
    admin.from('profiles').select('company_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
    admin.from('user_roles').select('role').eq('user_id', u.user.id),
  ]);
  const ok = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof?.autonomy_level === 'admin';
  return ok && prof?.company_id ? { userId: u.user.id, companyId: prof.company_id as string } : null;
}

// ---------- config ----------
interface Cfg {
  vendor: string; base_url: string; list_path: string; method: 'GET' | 'POST';
  auth: { type: 'bearer' | 'header' | 'basic'; header_name?: string };
  array_path: string; match: { by: 'email' | 'cpf' | 'registration'; field: string };
  fields: { status: string; clock_in?: string; bank_minutes?: string };
  status_map: Record<string, Status>; interval_min: number; params?: Record<string, string>;
}
const PATH_RE = /^[\w.\[\]-]{0,120}$/;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;           // literal IPv4: never needed for a SaaS API
  if (h.includes(':') || h.startsWith('[')) return true;          // literal IPv6
  return !h.includes('.');
}

function cleanConfig(c: any): Cfg | string {
  const base = String(c?.base_url || '').trim().replace(/\/+$/, '');
  let u: URL; try { u = new URL(base); } catch { return 'Informe o endereço (https://…) da API do seu sistema de ponto.'; }
  if (u.protocol !== 'https:') return 'O endereço da API precisa começar com https://.';
  if (isBlockedHost(u.hostname)) return 'Endereço não permitido. Use o endereço público da API do fornecedor.';
  if (u.port && u.port !== '443') return 'Use a porta padrão (443) da API.';
  const list_path = String(c?.list_path || '').trim();
  if (list_path && (!list_path.startsWith('/') || list_path.length > 300 || /\s/.test(list_path))) return 'O caminho da lista deve começar com / (ex.: /v1/ponto/hoje).';
  const method = c?.method === 'POST' ? 'POST' : 'GET';
  const authType = ['bearer', 'header', 'basic'].includes(c?.auth?.type) ? c.auth.type : 'bearer';
  const header_name = String(c?.auth?.header_name || '').trim();
  if (authType === 'header' && !/^[A-Za-z0-9-]{1,40}$/.test(header_name)) return 'Informe o nome do cabeçalho da chave (ex.: X-Api-Key).';
  const array_path = String(c?.array_path || '').trim(); if (!PATH_RE.test(array_path)) return 'Caminho da lista inválido.';
  const by = ['email', 'cpf', 'registration'].includes(c?.match?.by) ? c.match.by : 'email';
  const mfield = String(c?.match?.field || '').trim(); if (!mfield || !PATH_RE.test(mfield)) return 'Informe o campo que identifica a pessoa (ex.: email, cpf ou matricula).';
  const sfield = String(c?.fields?.status || '').trim(); if (!sfield || !PATH_RE.test(sfield)) return 'Informe o campo que traz a situação do ponto.';
  const cin = String(c?.fields?.clock_in || '').trim(), bank = String(c?.fields?.bank_minutes || '').trim();
  if ((cin && !PATH_RE.test(cin)) || (bank && !PATH_RE.test(bank))) return 'Campo de entrada ou banco de horas inválido.';
  const status_map: Record<string, Status> = {};
  for (const [k, v] of Object.entries(c?.status_map || {}).slice(0, 60)) {
    if ((STATUSES as readonly string[]).includes(v as string) && String(k).trim() && String(k).length <= 60) status_map[String(k).trim()] = v as Status;
  }
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(c?.params || {}).slice(0, 10)) if (/^[\w.-]{1,40}$/.test(k) && String(v).length <= 200) params[k] = String(v);
  const interval_min = Math.min(Math.max(Math.round(Number(c?.interval_min) || 15), 5), 60);
  return { vendor: String(c?.vendor || '').trim().slice(0, 40), base_url: base, list_path, method, auth: { type: authType, ...(authType === 'header' ? { header_name } : {}) }, array_path, match: { by, field: mfield }, fields: { status: sfield, ...(cin ? { clock_in: cin } : {}), ...(bank ? { bank_minutes: bank } : {}) }, status_map, interval_min, params };
}

const getPath = (obj: any, path: string): any => {
  if (!path) return obj;
  let cur = obj;
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) { if (cur == null) return undefined; cur = cur[part]; }
  return cur;
};
const normId = (by: string, v: unknown): string => {
  const s = String(v ?? '').trim(); if (!s) return '';
  return by === 'email' ? s.toLowerCase() : by === 'cpf' ? s.replace(/\D/g, '') : s.toLowerCase();
};
const toMinutes = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const m = String(v).trim().match(/^(-|\+)?(\d{1,4}):([0-5]\d)$/);
  if (m) return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : null;
};
const toIso = (v: unknown): string | null => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d.toISOString(); };
const mapStatus = (raw: unknown, map: Record<string, Status>): Status | null => {
  const s = String(raw ?? '').trim(); if (!s) return null;
  if (map[s]) return map[s];
  const low = s.toLowerCase(); for (const [k, v] of Object.entries(map)) if (k.toLowerCase() === low) return v;
  return (STATUSES as readonly string[]).includes(low) ? low as Status : null;
};

async function fetchRecords(cfg: Cfg, secret: string): Promise<any[]> {
  const url = new URL(cfg.base_url + cfg.list_path);
  for (const [k, v] of Object.entries(cfg.params || {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'ewvon-hr-sync/1' };
  if (cfg.auth.type === 'bearer') headers.Authorization = `Bearer ${secret}`;
  else if (cfg.auth.type === 'header') headers[cfg.auth.header_name || 'X-Api-Key'] = secret;
  else headers.Authorization = `Basic ${btoa(secret)}`;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { method: cfg.method, headers, redirect: 'manual', signal: ac.signal });
    if (r.status >= 300 && r.status < 400) throw new Error('O sistema respondeu com redirecionamento. Confira o endereço da API.');
    if (!r.ok) throw new Error(`O sistema de ponto recusou a consulta (HTTP ${r.status}). Confira a chave e o caminho.`);
    const text = await r.text(); if (text.length > 5_000_000) throw new Error('A resposta do sistema é grande demais (mais de 5 MB). Use um filtro por data.');
    let json: any; try { json = JSON.parse(text); } catch { throw new Error('A resposta do sistema não é JSON.'); }
    const arr = getPath(json, cfg.array_path);
    if (!Array.isArray(arr)) throw new Error(`Não achei a lista de pessoas em "${cfg.array_path || 'raiz'}". Confira o caminho da lista.`);
    return arr;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('O sistema de ponto demorou mais de 20 segundos para responder.');
    throw e;
  } finally { clearTimeout(t); }
}

interface Mapped { identifier: string; status: Status | null; clock_in: string | null; bank: number | null }
const mapRecords = (cfg: Cfg, recs: any[]): Mapped[] => recs.map((r) => ({
  identifier: normId(cfg.match.by, getPath(r, cfg.match.field)),
  status: mapStatus(getPath(r, cfg.fields.status), cfg.status_map),
  clock_in: cfg.fields.clock_in ? toIso(getPath(r, cfg.fields.clock_in)) : null,
  bank: cfg.fields.bank_minutes ? toMinutes(getPath(r, cfg.fields.bank_minutes)) : null,
}));

async function profileIndex(companyId: string) {
  const { data } = await admin.from('profiles').select('id, email, cpf, registration_number').eq('company_id', companyId).eq('is_active', true).neq('profile_type', 'system').limit(5000);
  const by: Record<string, Map<string, string>> = { email: new Map(), cpf: new Map(), registration: new Map() };
  for (const p of data || []) {
    const e = normId('email', p.email); if (e) by.email.set(e, p.id);
    const c = normId('cpf', p.cpf); if (c) by.cpf.set(c, p.id);
    const r = normId('registration', p.registration_number); if (r) by.registration.set(r, p.id);
  }
  return by;
}

async function applyRows(companyId: string, source: string, rows: { profile_id: string; status: Status; clock_in: string | null; bank: number | null }[], replaceAll: boolean, startedAt: string) {
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ company_id: companyId, profile_id: r.profile_id, source, status: r.status, clock_in: r.clock_in, hours_bank_minutes: r.bank, synced_at: now }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await admin.from('hr_people_status').upsert(payload.slice(i, i + 500), { onConflict: 'company_id,profile_id' });
    if (error) throw new Error('Não foi possível gravar os dados.');
  }
  if (replaceAll) await admin.from('hr_people_status').delete().eq('company_id', companyId).eq('source', source).lt('synced_at', startedAt);
}

async function runSync(companyId: string, row: any) {
  const startedAt = new Date().toISOString();
  try {
    const cfg = cleanConfig(row.config); if (typeof cfg === 'string') throw new Error(cfg);
    const secret = await open(row.secret_enc);
    const mapped = mapRecords(cfg, await fetchRecords(cfg, secret));
    const idx = await profileIndex(companyId);
    const rows: { profile_id: string; status: Status; clock_in: string | null; bank: number | null }[] = [];
    let unmatched = 0, unmapped = 0;
    for (const m of mapped) {
      const pid = m.identifier ? idx[cfg.match.by].get(m.identifier) : undefined;
      if (!pid) { unmatched++; continue; }
      if (!m.status) { unmapped++; continue; }
      rows.push({ profile_id: pid, status: m.status, clock_in: m.clock_in, bank: m.bank });
    }
    if (mapped.length > 0 && rows.length === 0) throw new Error('Nenhuma pessoa do sistema de ponto foi reconhecida no ewvon. Confira o campo de identificação (e-mail, CPF ou matrícula) e o mapeamento das situações.');
    await applyRows(companyId, 'api', rows, true, startedAt);
    await admin.from('company_integrations').update({ last_status: 'ok', last_error: null, last_used_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: true, total: mapped.length, matched: rows.length, unmatched, unmapped };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await admin.from('company_integrations').update({ last_status: 'erro', last_error: msg, last_used_at: new Date().toISOString() }).eq('id', row.id);
    return { error: msg };
  }
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    if (route === 'cron') {
      const { data: ok } = await admin.rpc('integrations_secret_ok', { _secret: req.headers.get('x-integrations-secret') || '' });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      const { data: rows } = await admin.from('company_integrations').select('id, company_id, config, secret_enc, last_used_at').eq('provider', 'hr').eq('enabled', true).not('secret_enc', 'is', null).limit(30);
      let ran = 0;
      for (const r of rows || []) {
        const every = Math.min(Math.max(Number(r.config?.interval_min) || 15, 5), 60) * 60_000;
        if (r.last_used_at && Date.now() - new Date(r.last_used_at).getTime() < every - 20_000) continue;
        await runSync(r.company_id, r); ran++;
      }
      return reply({ ok: true, ran });
    }

    if (route === 'ingest') {
      const k = req.headers.get('x-ewvon-key') || '';
      const m = k.match(/^ewk_([0-9a-f-]{36})_[A-Za-z0-9]{32,}$/);
      if (!m) return reply({ error: 'Chave inválida.' }, 401);
      const { data: kr } = await admin.from('hr_ingest_keys').select('key_hash').eq('company_id', m[1]).maybeSingle();
      if (!kr || kr.key_hash !== await sha(k)) return reply({ error: 'Chave inválida.' }, 401);
      const body = await req.json().catch(() => ({}));
      const recs = Array.isArray(body?.records) ? body.records.slice(0, 2000) : null;
      if (!recs) return reply({ error: 'Envie {"records":[...]}.' }, 400);
      const idx = await profileIndex(m[1]);
      const rows: { profile_id: string; status: Status; clock_in: string | null; bank: number | null }[] = [];
      let unmatched = 0, invalid = 0;
      for (const r of recs) {
        const by = r?.email ? 'email' : r?.cpf ? 'cpf' : r?.registration ? 'registration' : '';
        const pid = by ? idx[by].get(normId(by, r[by])) : undefined;
        const st = (STATUSES as readonly string[]).includes(String(r?.status)) ? r.status as Status : null;
        if (!st) { invalid++; continue; }
        if (!pid) { unmatched++; continue; }
        rows.push({ profile_id: pid, status: st, clock_in: toIso(r.clock_in), bank: toMinutes(r.hours_bank_minutes) });
      }
      await applyRows(m[1], 'push', rows, false, new Date().toISOString());
      return reply({ ok: true, received: recs.length, stored: rows.length, unmatched, invalid });
    }

    const who = await companyAdmin(req);
    if (!who) return reply({ error: 'Somente o administrador da empresa configura esta integração.' }, 403);
    const body = await req.json().catch(() => ({}));
    const { data: existing } = await admin.from('company_integrations').select('id, company_id, config, secret_enc, enabled').eq('company_id', who.companyId).eq('provider', 'hr').maybeSingle();

    if (route === 'save') {
      const cfg = cleanConfig(body.config); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secret = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : undefined;
      if (!secret && !existing?.secret_enc) return reply({ error: 'Informe a chave ou o token de acesso da API.' }, 400);
      const row: any = { company_id: who.companyId, provider: 'hr', enabled: body.enabled !== false, events: [], config: cfg, updated_by: who.userId, updated_at: new Date().toISOString() };
      if (secret) row.secret_enc = await seal(secret);
      const { error } = await admin.from('company_integrations').upsert(row, { onConflict: 'company_id,provider' });
      if (error) return reply({ error: 'Não foi possível salvar.' }, 500);
      return reply({ ok: true });
    }
    if (route === 'test') {
      const cfg = cleanConfig(body.config ?? existing?.config); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secretIn = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : (existing?.secret_enc ? await open(existing.secret_enc) : '');
      if (!secretIn) return reply({ error: 'Informe a chave ou o token de acesso da API.' }, 400);
      try {
        const mapped = mapRecords(cfg, await fetchRecords(cfg, secretIn));
        const idx = await profileIndex(who.companyId);
        const sample = mapped.slice(0, 3).map((m) => ({ matched: !!(m.identifier && idx[cfg.match.by].get(m.identifier)), identifier: m.identifier ? m.identifier.replace(/^(.{3}).*(.{2})$/, '$1***$2') : '', status: m.status, clock_in: m.clock_in, bank_minutes: m.bank }));
        const matched = mapped.filter((m) => m.identifier && idx[cfg.match.by].get(m.identifier)).length;
        const unmapped = mapped.filter((m) => !m.status).length;
        return reply({ ok: true, total: mapped.length, matched, unmapped, sample });
      } catch (e) { return reply({ error: (e as Error).message }, 400); }
    }
    if (route === 'sync') {
      if (!existing?.secret_enc) return reply({ error: 'Salve a integração antes de sincronizar.' }, 400);
      const r = await runSync(who.companyId, existing);
      return reply(r, 'error' in r ? 400 : 200);
    }
    if (route === 'remove') {
      await admin.from('company_integrations').delete().eq('company_id', who.companyId).eq('provider', 'hr');
      await admin.from('hr_people_status').delete().eq('company_id', who.companyId);
      await admin.from('hr_ingest_keys').delete().eq('company_id', who.companyId);
      return reply({ ok: true });
    }
    if (route === 'ingest-key') {
      const rnd = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('') + 'x'.repeat(8);
      const k = `ewk_${who.companyId}_${rnd}`;
      await admin.from('hr_ingest_keys').upsert({ company_id: who.companyId, key_hash: await sha(k), created_at: new Date().toISOString() }, { onConflict: 'company_id' });
      return reply({ ok: true, key: k, url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/hr-sync/ingest` });
    }
    return reply({ error: 'not found' }, 404);
  } catch (e) {
    console.error('hr-sync', (e as Error).message);
    return reply({ error: 'Erro interno.' }, 500);
  }
});
