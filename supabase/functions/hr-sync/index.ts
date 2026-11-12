// RH -> Dash 3D. The admin connects one or more people-management systems (Convenia, Pontomais, Nexti, Ahgora, ...) by
// pasting the API key. EVERY employee of each system is stored (admission, dismissal, salary, department, role, sex, birth,
// contract...) and the Dash 3D builds its metrics from them, not from the ewvon roster. Time-clock data is not imported.
// Columns are recognised automatically (synonym dictionary of the original Dash); data is refreshed every minute.
//   POST /hr-sync/presets  list of supported systems          POST /hr-sync/save    create/update a source
//   POST /hr-sync/test     recognised columns + preview       POST /hr-sync/sync    sync one source now
//   POST /hr-sync/toggle   { id, enabled }                    POST /hr-sync/remove  { id } disconnect and delete its people
//   POST /hr-sync/cron     database (Vault secret header): syncs the sources that are due
// A failure of the third-party API is reported as a failure: nothing is invented.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

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

// ---------- supported systems (from the original Dash analysis) ----------
interface Preset { name: string; cat: string; url?: string; path: string; auth: 'header' | 'bearer' | 'basic' | 'oauth'; header?: string; needsUrl: boolean; tokenLabel: string; note: string }
const BEARER = (name: string, cat: string): Preset => ({ name, cat, path: 'data', auth: 'bearer', needsUrl: true, tokenLabel: 'Token da API', note: 'Cole o endereço (URL) da API da sua conta em Opções avançadas.' });
const OAUTH = (name: string, cat: string): Preset => ({ name, cat, path: 'data', auth: 'oauth', needsUrl: true, tokenLabel: 'Client ID:Client Secret', note: 'Informe Client ID e Secret (id:secret), o endereço do login (token) e o endereço da API da sua conta.' });
const PRESETS: Record<string, Preset> = {
  convenia: { name: 'Convenia', cat: 'Gestão de pessoas', url: 'https://public-api.convenia.com.br/api/v3/employees?paginate=200', path: 'data', auth: 'header', header: 'token', needsUrl: false, tokenLabel: 'Token da Convenia', note: 'Token na área de integrações da Convenia. Nesta versão não busca sexo e desligados pessoa a pessoa.' },
  pontomais: { name: 'Pontomais', cat: 'Ponto eletrônico', url: 'https://api.pontomaisweb.com.br/external_api/v1/employees', path: 'employees', auth: 'header', header: 'access-token', needsUrl: false, tokenLabel: 'Token do Pontomais', note: 'Endereço sugerido. Confirme na documentação da sua conta.' },
  tangerino: { name: 'Sólides / Tangerino', cat: 'Ponto eletrônico', url: 'https://employer.tangerino.com.br/employee/find-all', path: 'content', auth: 'header', header: 'Authorization', needsUrl: false, tokenLabel: 'Token', note: 'Endereço sugerido. Confirme na documentação da sua conta.' },
  factorial: { name: 'Factorial', cat: 'Gestão de pessoas', url: 'https://api.factorialhr.com/api/2025-01-01/resources/employees/employees', path: 'data', auth: 'header', header: 'x-api-key', needsUrl: false, tokenLabel: 'Chave da API', note: 'Endereço sugerido. Confirme a versão da API na documentação.' },
  kenjo: { name: 'Kenjo', cat: 'Gestão de pessoas', url: 'https://api.kenjo.io/api/v1/employees', path: '', auth: 'bearer', needsUrl: false, tokenLabel: 'Token', note: 'Endereço sugerido. Confirme na documentação da sua conta.' },
  ahgora: BEARER('Ahgora', 'Ponto eletrônico'), pontotel: BEARER('Pontotel', 'Ponto eletrônico'), secullum: BEARER('Secullum', 'Ponto eletrônico'),
  dimep: BEARER('Dimep', 'Ponto eletrônico'), henry: BEARER('Henry', 'Ponto eletrônico'), controlid: BEARER('Control iD', 'Ponto eletrônico'), pontofopag: BEARER('PontoFopag', 'Ponto eletrônico'),
  senior: BEARER('Senior HCM', 'Gestão de pessoas'), sankhya: BEARER('Sankhya', 'Gestão de pessoas'), protheus: BEARER('TOTVS Protheus', 'Gestão de pessoas'), adp: BEARER('ADP', 'Gestão de pessoas'),
  bamboohr: BEARER('BambooHR', 'Gestão de pessoas'), hibob: BEARER('HiBob', 'Gestão de pessoas'), rippling: BEARER('Rippling', 'Gestão de pessoas'), deel: BEARER('Deel', 'Gestão de pessoas'), gusto: BEARER('Gusto', 'Gestão de pessoas'),
  totvs: { name: 'TOTVS RM', cat: 'Gestão de pessoas', path: 'data', auth: 'basic', needsUrl: true, tokenLabel: 'usuário:senha', note: 'Informe usuário:senha e cole o endereço da API do seu servidor em Opções avançadas.' },
  nexti: OAUTH('Nexti', 'Ponto e escalas'), workday: OAUTH('Workday', 'Gestão de pessoas'), sap: OAUTH('SAP SuccessFactors', 'Gestão de pessoas'), oracle: OAUTH('Oracle HCM', 'Gestão de pessoas'), personio: OAUTH('Personio', 'Gestão de pessoas'),
  custom: BEARER('API própria', 'Seu sistema'), generic: { name: 'Outro sistema (JSON)', cat: 'Qualquer API', path: '', auth: 'bearer', needsUrl: true, tokenLabel: 'Token da API', note: 'Qualquer API que devolva uma lista em JSON.' },
};

interface Cfg { preset: string; url: string; path: string; auth: Preset['auth']; header: string; oauth_url: string; every: number }
const PATH_RE = /^[\w.\[\]-]{0,120}$/;

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  if (h.includes(':') || h.startsWith('[')) return true;
  return !h.includes('.');
}
function checkUrl(raw: string, what: string): string | null {
  let u: URL; try { u = new URL(raw); } catch { return `Informe o endereço (https://…) ${what}.`; }
  if (u.protocol !== 'https:') return `O endereço ${what} precisa começar com https://.`;
  if (isBlockedHost(u.hostname)) return `Endereço não permitido (${what}). Use o endereço público da API do fornecedor.`;
  if (u.port && u.port !== '443') return 'Use a porta padrão (443) da API.';
  return null;
}

function cleanConfig(c: any): Cfg | string {
  const id = String(c?.preset || 'custom'); const p = PRESETS[id]; if (!p) return 'Sistema não suportado.';
  const url = String((p.needsUrl ? c?.url : (c?.url || p.url)) || '').trim();
  if (!url) return 'Cole o endereço (URL) da API do seu sistema em Opções avançadas.';
  const bad = checkUrl(url, 'da API'); if (bad) return bad;
  const path = String(c?.path ?? p.path).trim(); if (!PATH_RE.test(path)) return 'Caminho da lista inválido.';
  let header = p.header || ''; if (p.auth === 'header' && c?.header_name) header = String(c.header_name).trim();
  if (p.auth === 'header' && !/^[A-Za-z0-9-]{1,40}$/.test(header)) return 'Nome do cabeçalho inválido.';
  let oauth_url = '';
  if (p.auth === 'oauth') { oauth_url = String(c?.oauth_url || '').trim(); const b2 = checkUrl(oauth_url, 'do login (token)'); if (b2) return b2; }
  const every = Math.min(Math.max(Math.round(Number(c?.every) || 1), 1), 60);
  return { preset: id, url, path, auth: p.auth, header, oauth_url, every };
}

// ---------- reading the API ----------
const getPath = (obj: any, path: string): any => {
  if (!path) return obj;
  let cur = obj;
  for (const part of path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) { if (cur == null) return undefined; cur = cur[part]; }
  return cur;
};
function findArr(o: any, d: number): any[] | null {
  if (Array.isArray(o)) return o;
  if (o && typeof o === 'object' && d < 3) { let best: any[] | null = null; for (const k in o) { const a = findArr(o[k], d + 1); if (a && (!best || a.length > best.length)) best = a; } return best; }
  return null;
}
function pgInfo(j: any) {
  const o = (j && typeof j === 'object' && !Array.isArray(j)) ? j : {}; const r: { total?: number; page?: number; pages?: number; more?: boolean } = {};
  for (const c of [o, o.pagination, o.meta, o.paging, o.page_info, o.pageInfo, o.meta?.pagination, (o.data && !Array.isArray(o.data)) ? o.data.pagination : null]) {
    if (!c || typeof c !== 'object') continue;
    const g = (...ks: string[]) => { for (const k of ks) { const v = c[k]; if (typeof v === 'number' && isFinite(v)) return v; if (typeof v === 'string' && /^\d+$/.test(v)) return +v; } return undefined; };
    if (r.total == null) r.total = g('total', 'total_count', 'totalCount', 'total_items', 'totalItems', 'total_records', 'count');
    if (r.page == null) r.page = g('page', 'current_page', 'currentPage', 'page_number');
    if (r.pages == null) r.pages = g('total_pages', 'totalPages', 'last_page', 'lastPage', 'page_count', 'pages');
    for (const k of ['has_more', 'hasMore', 'has_next', 'hasNext', 'has_next_page']) if (r.more == null && typeof c[k] === 'boolean') r.more = c[k];
  }
  return r;
}

const oauthCache = new Map<string, { tok: string; exp: number }>();
async function oauthToken(url: string, idSecret: string): Promise<string> {
  const k = url + '|' + idSecret.split(':')[0]; const c = oauthCache.get(k); if (c && c.exp > Date.now() + 30_000) return c.tok;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(idSecret) }, body: new URLSearchParams({ grant_type: 'client_credentials' }), redirect: 'manual' });
  if (!r.ok) throw new Error(`O login OAuth não foi aceito (erro ${r.status}). Confira Client ID, Secret e o endereço do token.`);
  const j = await r.json().catch(() => ({})); const tok = j.access_token || j.token; if (!tok) throw new Error('O login OAuth não devolveu um token.');
  oauthCache.set(k, { tok, exp: Date.now() + (Number(j.expires_in) || 300) * 1000 }); return tok;
}

async function fetchRecords(cfg: Cfg, secret: string): Promise<any[]> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'ewvon-hr-sync/2' };
  if (cfg.auth === 'bearer') headers.Authorization = `Bearer ${secret}`;
  else if (cfg.auth === 'header') headers[cfg.header] = secret;
  else if (cfg.auth === 'basic') headers.Authorization = `Basic ${btoa(unescape(encodeURIComponent(secret)))}`;
  else headers.Authorization = `Bearer ${await oauthToken(cfg.oauth_url, secret)}`;
  const deadline = Date.now() + 45_000;
  let next: string | null = cfg.url, pages = 0, pg = 1, first = '', all: any[] = [];
  const pageUrl = (u: string, n: number) => { const x = new URL(u); x.searchParams.set('page', String(n)); return x.href; };
  while (next && pages < 30) {
    if (Date.now() > deadline) throw new Error('O sistema de ponto demorou demais para responder.');
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20_000);
    let r: Response;
    try { r = await fetch(next, { headers, redirect: 'manual', signal: ac.signal }); }
    catch (e) { throw new Error((e as Error).name === 'AbortError' ? 'O sistema de ponto demorou mais de 20 segundos para responder.' : 'Não consegui acessar a API. Confira o endereço (https).'); }
    finally { clearTimeout(t); }
    if (r.status >= 300 && r.status < 400) throw new Error('O sistema respondeu com redirecionamento. Confira o endereço da API.');
    if (r.status === 429) throw new Error('O sistema limitou as consultas (muitas por minuto). Aumente o intervalo de atualização.');
    if (!r.ok) throw new Error(`O sistema recusou a consulta (HTTP ${r.status})${r.status === 401 || r.status === 403 ? '. Confira o token e as permissões dele' : ''}.`);
    const text = await r.text(); if (text.length > 8_000_000) throw new Error('A resposta do sistema é grande demais.');
    let j: any; try { j = JSON.parse(text); } catch { throw new Error('A resposta do sistema não é JSON.'); }
    const a = cfg.path ? getPath(j, cfg.path) : findArr(j, 0);
    if (!Array.isArray(a) || (!a.length && pages === 0)) throw new Error(`A resposta não tem uma lista de pessoas${cfg.path ? ` em "${cfg.path}"` : ''}. Em Opções avançadas, informe o caminho dos dados (ex.: data.items).`);
    const sig = a.length ? JSON.stringify(a[0]) : '';
    if (pages > 0 && (!a.length || sig === first)) break;
    if (pages === 0) first = sig;
    all = all.concat(a); pages++;
    const nu = (j && typeof j.next_page_url === 'string' && /^https:/i.test(j.next_page_url)) ? j.next_page_url : null;
    if (nu) { const bad = checkUrl(nu, 'da próxima página'); if (bad) throw new Error(bad); next = nu; continue; }
    const m = pgInfo(j); const cur = m.page || pg; let more = false;
    if (m.pages != null) more = cur < m.pages; else if (m.total != null) more = all.length < m.total; else if (m.more != null) more = m.more;
    else if (pages === 1 && [10, 15, 20, 25, 30, 50, 100, 200, 250, 500, 1000].includes(a.length)) more = true;
    if (more) { pg = cur + 1; next = pageUrl(cfg.url, pg); } else next = null;
  }
  return all;
}

// ---------- recognising the columns (synonyms from the original Dash) ----------
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const SYN: Record<string, string[]> = {
  nome: ['nome', 'colaborador', 'funcionario', 'empregado', 'name', 'fullname', 'employeename', 'nomecompleto', 'employee', 'nomefuncionario', 'displayname', 'employeefullname'],
  depto: ['departamento', 'depto', 'setor', 'area', 'department', 'dept', 'departmentname', 'departamentonome', 'departamentodescricao', 'lotacao', 'secao', 'departmentdescription'],
  cc: ['centrodecusto', 'centrocusto', 'cc', 'costcenter', 'costcentre', 'centrodecustos', 'andar', 'floor'],
  cargo: ['cargo', 'funcao', 'role', 'position', 'jobtitle', 'title', 'job'],
  sal: ['salario', 'salariobase', 'remuneracao', 'salariomensal', 'salary', 'wage', 'basesalary', 'pay'],
  adm: ['admissao', 'dataadmissao', 'dtadmissao', 'dataadm', 'hiredate', 'hiredat', 'startdate', 'admissiondate', 'hiredon', 'dateofhire', 'admittedat', 'hiringdate', 'datacontratacao', 'dtcontratacao', 'contratacao', 'hireddate', 'startedat', 'contractstart'],
  dem: ['demissao', 'desligamento', 'datademissao', 'datadesligamento', 'dtdemissao', 'datadesl', 'terminationdate', 'enddate', 'termination', 'terminatedat', 'leavedate', 'dismissaldate', 'dismissal'],
  sexo: ['sexo', 'genero', 'gender', 'sex'],
  nasc: ['nascimento', 'datanascimento', 'dtnascimento', 'birthdate', 'birthday'],
  ctr: ['tipocontrato', 'contrato', 'vinculo', 'regime', 'tipodevinculo', 'contracttype', 'employmenttype'],
  fv: ['feriasvencidas', 'diasferiasvencidas', 'feriasvencendo', 'overduevacation', 'vacationoverdue'],
  kemp: ['empresa', 'filial', 'company', 'codigoempresa'],
  km: ['matricula', 'matr', 'registro', 'chapa', 'codigofuncionario', 'employeenumber', 'registration'],
  xid: ['id', 'userid', 'usuarioid', 'idusuario', 'uuid', 'useruuid', 'employeeuuid', 'employeeid', 'idfuncionario'],
};
const LABELS: Record<string, string> = { nome: 'Nome', depto: 'Departamento', cc: 'Centro de custo', cargo: 'Cargo', sal: 'Salário', adm: 'Admissão', dem: 'Demissão', sexo: 'Sexo', nasc: 'Nascimento', ctr: 'Contrato', fv: 'Férias vencidas', kemp: 'Empresa', km: 'Matrícula', xid: 'Código' };

function flat(o: any, pre: string, out: Record<string, unknown>) {
  for (const k in o) {
    const v = o[k]; const n = pre ? pre + ' ' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) { const nm = v.name ?? v.nome ?? v.title ?? v.label ?? v.descricao; if (nm != null && typeof nm !== 'object') out[n] = nm; else flat(v, n, out); }
    else out[n] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}
const toNum = (v: unknown): number | null => {
  if (typeof v === 'number') return isFinite(v) ? v : null; if (v == null) return null;
  let s = String(v).replace(/[R$\s]/g, ''); if (!s) return null; if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return isFinite(n) ? n : null;
};
const toMinutes = (v: unknown): number | null => {   // hours as number or "-10:30" -> minutes
  if (v == null || v === '') return null;
  const m = String(v).trim().match(/^(-|\+)?(\d{1,4}):([0-5]\d)$/); if (m) return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  const n = toNum(v); return n == null ? null : Math.round(n * 60);
};
const toIso = (v: unknown): string | null => { if (!v) return null; const d = new Date(String(v)); return isNaN(d.getTime()) ? null : d.toISOString(); };
const toDate = (v: unknown): string | null => { const i = toIso(v); return i ? i.slice(0, 10) : null; };

interface Emp { key: string; name: string; depto: string; cargo: string; sexo: string; ctr: string; cc: string; kemp: string; adm: string | null; dem: string | null; nasc: string | null; salary: number | null; fv: number | null }
function detectColumns(recs: any[]): Record<string, string> {
  const keys = new Map<string, string>();
  for (const r of recs.slice(0, 30)) if (r && typeof r === 'object') for (const k of Object.keys(flat(r, '', {}))) { const n = norm(k); if (n && !keys.has(n)) keys.set(n, k); }
  const map: Record<string, string> = {};
  for (const f in SYN) for (const syn of SYN[f]) { if (keys.has(syn)) { map[f] = keys.get(syn)!; break; } }
  return map;
}
function mapEmployees(recs: any[]): { emps: Emp[]; columns: Record<string, string> } {
  const columns = detectColumns(recs); const emps: Emp[] = []; const seen = new Set<string>();
  const txt = (v: unknown) => (v == null ? '' : String(v).trim());
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    const o: any = flat(r, '', {});
    if (o.name && o.last_name) o.name = `${o.name} ${o.last_name}`; else if (o.first_name && o.last_name) o.name = `${o.first_name} ${o.last_name}`;
    const g = (f: string) => columns[f] ? o[columns[f]] : undefined;
    const name = txt(g('nome') ?? o.name); const adm = toDate(g('adm'));
    if (!name && !adm) continue;
    let key = txt(g('xid')) || txt(g('km')) || `${norm(name)}|${adm ?? ''}`;
    if (seen.has(key)) { let i = 2; while (seen.has(`${key}#${i}`)) i++; key = `${key}#${i}`; }
    seen.add(key);
    emps.push({ key: key.slice(0, 120), name: name.slice(0, 160), depto: txt(g('depto')).slice(0, 120), cargo: txt(g('cargo')).slice(0, 120), sexo: txt(g('sexo')).slice(0, 20), ctr: txt(g('ctr')).slice(0, 60), cc: txt(g('cc')).slice(0, 120), kemp: txt(g('kemp')).slice(0, 120), adm, dem: toDate(g('dem')), nasc: toDate(g('nasc')), salary: toNum(g('sal')), fv: toNum(g('fv')) });
  }
  return { emps, columns };
}

const MAX_EMPLOYEES = 20000;
async function runSync(row: any) {
  const startedAt = new Date().toISOString();
  try {
    const cfg = cleanConfig(row.config); if (typeof cfg === 'string') throw new Error(cfg);
    const recs = await fetchRecords(cfg, await open(row.secret_enc));
    const { emps, columns } = mapEmployees(recs);
    if (!columns.depto || !columns.adm) {
      const seen = Object.keys(columns).map((k) => LABELS[k] || k).join(', ') || 'nenhuma';
      throw new Error(`Não encontrei as colunas de Departamento e Admissão na resposta (reconhecidas: ${seen}). Em Opções avançadas, confira o endereço e o caminho da lista.`);
    }
    if (!emps.length) throw new Error('A resposta não trouxe nenhum colaborador com nome ou data de admissão.');
    const now = new Date().toISOString();
    const payload = emps.slice(0, MAX_EMPLOYEES).map((e) => ({ source_id: row.id, company_id: row.company_id, ext_key: e.key, name: e.name, depto: e.depto || null, cargo: e.cargo || null, sexo: e.sexo || null, ctr: e.ctr || null, cc: e.cc || null, kemp: e.kemp || null, adm: e.adm, dem: e.dem, nasc: e.nasc, salary: e.salary, vacation_overdue: e.fv, synced_at: now }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await admin.from('hr_employees').upsert(payload.slice(i, i + 500), { onConflict: 'source_id,ext_key' });
      if (error) throw new Error('Não foi possível gravar os colaboradores.');
    }
    await admin.from('hr_employees').delete().eq('source_id', row.id).lt('synced_at', startedAt);
    await admin.from('hr_sources').update({ last_status: 'ok', last_error: null, last_used_at: new Date().toISOString(), last_count: payload.length }).eq('id', row.id);
    return { ok: true, total: payload.length, columns: Object.keys(columns).map((k) => LABELS[k] || k) };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await admin.from('hr_sources').update({ last_status: 'erro', last_error: msg, last_used_at: new Date().toISOString() }).eq('id', row.id);
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
      const { data: rows } = await admin.from('hr_sources').select('id, company_id, config, secret_enc, last_used_at').eq('enabled', true).not('secret_enc', 'is', null).limit(60);
      let ran = 0;
      for (const r of rows || []) {
        const every = Math.min(Math.max(Number(r.config?.every) || 1, 1), 60) * 60_000;
        if (r.last_used_at && Date.now() - new Date(r.last_used_at).getTime() < every - 8_000) continue;
        await runSync(r); ran++;
      }
      return reply({ ok: true, ran });
    }

    const who = await companyAdmin(req);
    if (!who) return reply({ error: 'Somente o administrador da empresa configura esta integração.' }, 403);
    const body = await req.json().catch(() => ({}));
    const own = async (id: unknown) => {
      if (typeof id !== 'string') return null;
      const { data } = await admin.from('hr_sources').select('id, company_id, label, preset, config, secret_enc, enabled').eq('id', id).eq('company_id', who.companyId).maybeSingle();
      return data;
    };

    if (route === 'presets') {
      return reply({ ok: true, presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, cat: p.cat, needsUrl: p.needsUrl, auth: p.auth, header: p.header || null, tokenLabel: p.tokenLabel, note: p.note, url: p.url || null, path: p.path })) });
    }
    if (route === 'save') {
      const cfg = cleanConfig(body); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secret = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : undefined;
      const existing = body.id ? await own(body.id) : null;
      if (body.id && !existing) return reply({ error: 'Integração não encontrada.' }, 404);
      if (!existing) {
        const { count } = await admin.from('hr_sources').select('id', { count: 'exact', head: true }).eq('company_id', who.companyId);
        if ((count ?? 0) >= 6) return reply({ error: 'Limite de 6 sistemas conectados por empresa.' }, 400);
      }
      if (!secret && !existing?.secret_enc) return reply({ error: 'Cole a chave (token) da API.' }, 400);
      const label = String(body.label || '').trim().slice(0, 60) || PRESETS[cfg.preset].name;
      const row: any = { company_id: who.companyId, label, preset: cfg.preset, config: cfg, enabled: body.enabled !== false, updated_at: new Date().toISOString() };
      if (secret) row.secret_enc = await seal(secret);
      let id = existing?.id as string | undefined;
      if (existing) { const { error } = await admin.from('hr_sources').update(row).eq('id', existing.id); if (error) return reply({ error: 'Não foi possível salvar.' }, 500); }
      else { const { data, error } = await admin.from('hr_sources').insert({ ...row, created_by: who.userId }).select('id').single(); if (error || !data) return reply({ error: 'Não foi possível salvar.' }, 500); id = data.id; }
      const saved = await own(id);
      const first = saved ? await runSync(saved) : null;
      return reply({ ok: true, id, first });
    }
    if (route === 'test') {
      const existing = body.id ? await own(body.id) : null;
      const cfg = cleanConfig(body.preset ? body : existing?.config); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secretIn = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : (existing?.secret_enc ? await open(existing.secret_enc) : '');
      if (!secretIn) return reply({ error: 'Cole a chave (token) da API.' }, 400);
      try {
        const { emps, columns } = mapEmployees(await fetchRecords(cfg, secretIn));
        const mask = (n: string) => n.replace(/^(.{2}).*$/, '$1***');
        const missing = ['depto', 'adm'].filter((k) => !columns[k]).map((k) => LABELS[k]);
        return reply({ ok: true, total: emps.length, active: emps.filter((e) => !e.dem).length, dismissed: emps.filter((e) => !!e.dem).length, columns: Object.keys(columns).map((k) => LABELS[k] || k), missing, sample: emps.slice(0, 3).map((e) => ({ name: mask(e.name), depto: e.depto || null, cargo: e.cargo || null, adm: e.adm })) });
      } catch (e) { return reply({ error: (e as Error).message }, 400); }
    }
    if (route === 'sync') {
      const src = await own(body.id); if (!src) return reply({ error: 'Integração não encontrada.' }, 404);
      const r = await runSync(src);
      return reply(r, 'error' in r ? 400 : 200);
    }
    if (route === 'toggle') {
      const src = await own(body.id); if (!src) return reply({ error: 'Integração não encontrada.' }, 404);
      await admin.from('hr_sources').update({ enabled: body.enabled === true, updated_at: new Date().toISOString() }).eq('id', src.id);
      return reply({ ok: true });
    }
    if (route === 'remove') {
      const src = await own(body.id); if (!src) return reply({ error: 'Integração não encontrada.' }, 404);
      await admin.from('hr_sources').delete().eq('id', src.id);   // its employees go with it (cascade)
      return reply({ ok: true });
    }
    return reply({ error: 'not found' }, 404);
  } catch (e) {
    console.error('hr-sync', (e as Error).message);
    return reply({ error: 'Erro interno.' }, 500);
  }
});
