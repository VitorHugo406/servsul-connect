// RH -> Dash 3D. The admin connects one or more people-management systems (Convenia, Pontomais, Nexti, Ahgora, ...) by
// pasting the API key. EVERY employee of each system is stored (admission, dismissal, salary, department, role, sex, birth,
// contract...) and the Dash 3D builds its metrics from them, not from the ewvon roster. Time-clock data is not imported.
// Columns are recognised automatically (synonym dictionary of the original Dash); data is refreshed every 15–60 minutes (minimum 15: a full re-sync every minute kept the database busy).
//   POST /hr-sync/presets  list of supported systems          POST /hr-sync/save    create/update a source
//   POST /hr-sync/test     recognised columns + preview       POST /hr-sync/sync    sync one source now
//   POST /hr-sync/toggle   { id, enabled }                    POST /hr-sync/remove  { id } disconnect and delete its people
//   POST /hr-sync/import-preview { id }  how many people can become users, plan seats left
//   POST /hr-sync/import-run { id, mode:'all' }  create the users (alphabetical, up to the plan limit); call again while pending > 0
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
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/(www\.)?ewvon\.com$/.test(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
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
  convenia: { name: 'Convenia', cat: 'Gestão de pessoas', url: 'https://public-api.convenia.com.br/api/v3/employees?paginate=200', path: 'data', auth: 'header', header: 'token', needsUrl: false, tokenLabel: 'Token da Convenia', note: 'Token na área de integrações da Convenia. Busca também cargo, sexo e demitidos; os detalhes completam aos poucos por causa do limite da Convenia.' },
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

// The scheduler never syncs a source more often than this (minutes), whatever was saved before.
const MIN_EVERY = 15;
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
  const every = Math.min(Math.max(Math.round(Number(c?.every) || 60), MIN_EVERY), 60);
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

async function buildHeaders(cfg: Cfg, secret: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'ewvon-hr-sync/3' };
  if (cfg.auth === 'bearer') headers.Authorization = `Bearer ${secret}`;
  else if (cfg.auth === 'header') headers[cfg.header] = secret;
  else if (cfg.auth === 'basic') headers.Authorization = `Basic ${btoa(unescape(encodeURIComponent(secret)))}`;
  else headers.Authorization = `Bearer ${await oauthToken(cfg.oauth_url, secret)}`;
  return headers;
}

async function fetchRecords(cfg: Cfg, secret: string): Promise<any[]> {
  const headers = await buildHeaders(cfg, secret);
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
  cargo: ['cargo', 'funcao', 'job', 'jobtitle', 'jobname', 'jobposition', 'position', 'positionname', 'occupation', 'ocupacao', 'cargonome', 'role', 'title'],
  sal: ['salario', 'salariobase', 'remuneracao', 'salariomensal', 'salary', 'wage', 'basesalary', 'pay', 'salarysalary', 'salaryvalue', 'salaryamount', 'salarybase', 'salariovalor'],
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
function detectColumns(recs: any[], dict: Record<string, string[]> = SYN, tailOnly?: string[]): Record<string, string> {
  const SYN = dict;
  const keys = new Map<string, string>();
  for (const r of recs.slice(0, 30)) if (r && typeof r === 'object') for (const k of Object.keys(flat(r, '', {}))) { const n = norm(k); if (n && !keys.has(n)) keys.set(n, k); }
  const map: Record<string, string> = {};
  for (const f in SYN) for (const syn of SYN[f]) { if (keys.has(syn)) { map[f] = keys.get(syn)!; break; } }
  // second pass for nested fields ("job name", "salary value"): the last word of the key may be the known name
  for (const f in SYN) {
    if (map[f] || (tailOnly && !tailOnly.includes(f))) continue;
    for (const [n, orig] of keys) { const tail = norm(orig.split(' ').pop()); if (tail !== n && SYN[f].includes(tail) && !Object.values(map).includes(orig)) { map[f] = orig; break; } }
  }
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Convenia: the list of active people lacks some fields and dismissed people are on another endpoint. Same calls the
// original Dash made: /employees (active), /employees/dismissed (last years) and /employees/{id} for the details
// (job, gender, dismissal date). The API allows ~50 calls per minute, so each run fetches a few details and the rest
// come on the next runs; what was fetched stays stored.
const CONV_DETAILS_PER_RUN = 32;
async function convGet(url: string, headers: Record<string, string>): Promise<any | null | 'rate'> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const r = await fetch(url, { headers, redirect: 'manual', signal: ac.signal });
    if (r.status === 429) return 'rate';
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`A Convenia respondeu com erro ${r.status}${r.status === 401 || r.status === 403 ? ' (confira o token e as permissões dele)' : ''}.`);
    return await r.json();
  } finally { clearTimeout(t); }
}
const detailOf = (j: any) => (j && j.data && !Array.isArray(j.data)) ? j.data : (j && Array.isArray(j.data) ? j.data[0] : j) || {};
const genderOf = (d: any) => { const g = String(d?.gender ?? '').trim().toUpperCase().charAt(0); return g === 'M' || g === 'F' ? g : ''; };

async function convEnrich(cfg: Cfg, secret: string, sourceId: string, active: Emp[]): Promise<{ emps: Emp[]; note: string }> {
  const headers = await buildHeaders(cfg, secret);
  const m = cfg.url.match(/^(https:\/\/[^/]+\/api\/v3)/i); const base = m ? m[1] : 'https://public-api.convenia.com.br/api/v3';
  let note = '';
  const from = new Date(); from.setFullYear(from.getFullYear() - 3);
  let disRecs: any[] = [];
  try { disRecs = await fetchRecords({ ...cfg, url: `${base}/employees/dismissed?paginate=200&from_date=${from.toISOString().slice(0, 10)}`, path: cfg.path || 'data' }, secret); }
  catch (e) { note = `Demitidos: ${(e as Error).message}`; }
  const activeIds = new Set(active.map((e) => e.key));
  const dis = disRecs.filter((x) => x && x.id != null && !activeIds.has(String(x.id)));
  const disDate = new Map<string, string | null>(dis.map((x) => [String(x.id), toDate(x.dismissal?.date ?? x.dismissal_date ?? x.dismissal)]));
  const { data: stored } = await admin.from('hr_employees').select('*').eq('source_id', sourceId).limit(MAX_EMPLOYEES);
  const byKey = new Map<string, any>((stored || []).map((r: any) => [r.ext_key, r]));
  const todo: { id: string; isDis: boolean }[] = [];
  for (const x of dis) { const id = String(x.id); const c = byKey.get(id); if (!c || !c.name) todo.push({ id, isDis: true }); }
  for (const e of active) { const c = byKey.get(e.key); if ((!e.cargo && !c?.cargo) || (!e.sexo && !c?.sexo)) todo.push({ id: e.key, isDis: false }); }
  const fetched = new Map<string, Emp>();
  let n = 0;
  for (const t of todo.slice(0, CONV_DETAILS_PER_RUN)) {
    if (n++) await sleep(1300);
    let j: any;
    try { j = await convGet(`${base}/employees/${encodeURIComponent(t.id)}`, headers); } catch (e) { note = note || (e as Error).message; break; }
    if (j === 'rate') { note = note || 'A Convenia limitou as consultas; os detalhes continuam na próxima atualização.'; break; }
    if (!j) continue;
    const d = detailOf(j); const one = mapEmployees([d]).emps[0];
    const b1: Emp = one ? { ...one, key: t.id } : { key: t.id, name: '', depto: '', cargo: '', sexo: '', ctr: '', cc: '', kemp: '', adm: null, dem: null, nasc: null, salary: null, fv: null };
    b1.sexo = genderOf(d) || b1.sexo;
    if (t.isDis) b1.dem = b1.dem || disDate.get(t.id) || toDate(d?.dismissal?.date) || null;
    fetched.set(t.id, b1);
  }
  const out: Emp[] = [];
  for (const e of active) {
    const c = byKey.get(e.key); const f = fetched.get(e.key);
    out.push({ ...e, cargo: e.cargo || f?.cargo || c?.cargo || '', sexo: e.sexo || f?.sexo || c?.sexo || '', depto: e.depto || f?.depto || '', ctr: e.ctr || f?.ctr || c?.ctr || '', cc: e.cc || f?.cc || c?.cc || '' });
  }
  for (const x of dis) {
    const id = String(x.id); const f = fetched.get(id); const c = byKey.get(id);
    if (f) out.push({ ...f, dem: f.dem || disDate.get(id) || null });
    else if (c && c.name) out.push({ key: id, name: c.name, depto: c.depto || '', cargo: c.cargo || '', sexo: c.sexo || '', ctr: c.ctr || '', cc: c.cc || '', kemp: c.kemp || '', adm: c.adm, dem: c.dem || disDate.get(id) || null, nasc: c.nasc, salary: c.salary == null ? null : Number(c.salary), fv: c.vacation_overdue == null ? null : Number(c.vacation_overdue) });
  }
  const pending = Math.max(0, todo.length - fetched.size);
  if (pending) note = note || `${pending} cadastro(s) ainda serão completados nas próximas atualizações (cargo, sexo e demitidos).`;
  return { emps: out, note };
}

async function runSync(row: any) {
  try {
    const cfg = cleanConfig(row.config); if (typeof cfg === 'string') throw new Error(cfg);
    const secret = await open(row.secret_enc);
    const recs = await fetchRecords(cfg, secret);
    let { emps, columns } = mapEmployees(recs);
    if (!columns.depto || !columns.adm) {
      const seen = Object.keys(columns).map((k) => LABELS[k] || k).join(', ') || 'nenhuma';
      throw new Error(`Não encontrei as colunas de Departamento e Admissão na resposta (reconhecidas: ${seen}). Em Opções avançadas, confira o endereço e o caminho da lista.`);
    }
    if (!emps.length) throw new Error('A resposta não trouxe nenhum colaborador com nome ou data de admissão.');
    let note = '';
    if (cfg.preset === 'convenia') { const r = await convEnrich(cfg, secret, row.id, emps); emps = r.emps; note = r.note; }
    const now = new Date().toISOString();
    const payload = emps.slice(0, MAX_EMPLOYEES).map((e) => ({ source_id: row.id, company_id: row.company_id, ext_key: e.key, name: e.name, depto: e.depto || null, cargo: e.cargo || null, sexo: e.sexo || null, ctr: e.ctr || null, cc: e.cc || null, kemp: e.kemp || null, adm: e.adm, dem: e.dem, nasc: e.nasc, salary: e.salary, vacation_overdue: e.fv, synced_at: now }));
    // Write ONLY what changed: rewriting every row on every run flooded the WAL (and realtime) for nothing.
    const { data: cur } = await admin.from('hr_employees').select('ext_key,name,depto,cargo,sexo,ctr,cc,kemp,adm,dem,nasc,salary,vacation_overdue').eq('source_id', row.id).limit(MAX_EMPLOYEES + 500);
    const sig = (r: any) => JSON.stringify([r.name, r.depto, r.cargo, r.sexo, r.ctr, r.cc, r.kemp, r.adm, r.dem, r.nasc, r.salary == null ? null : Number(r.salary), r.vacation_overdue == null ? null : Number(r.vacation_overdue)]);
    const have = new Map<string, string>(((cur || []) as any[]).map((r) => [String(r.ext_key), sig(r)]));
    const changed = payload.filter((p) => have.get(String(p.ext_key)) !== sig(p));
    for (let i = 0; i < changed.length; i += 500) {
      const { error } = await admin.from('hr_employees').upsert(changed.slice(i, i + 500), { onConflict: 'source_id,ext_key' });
      if (error) throw new Error('Não foi possível gravar os colaboradores.');
    }
    const keep = new Set(payload.map((p) => String(p.ext_key)));
    const gone = [...have.keys()].filter((k) => !keep.has(k));
    for (let i = 0; i < gone.length; i += 200) await admin.from('hr_employees').delete().eq('source_id', row.id).in('ext_key', gone.slice(i, i + 200));
    await admin.from('hr_sources').update({ last_status: 'ok', last_error: note || null, last_used_at: new Date().toISOString(), last_count: payload.length }).eq('id', row.id);
    return { ok: true, total: payload.length, dismissed: payload.filter((p) => p.dem).length, columns: Object.keys(columns).map((k) => LABELS[k] || k), note };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await admin.from('hr_sources').update({ last_status: 'erro', last_error: msg, last_used_at: new Date().toISOString() }).eq('id', row.id);
    return { error: msg };
  }
}

// ---------- importing people as ewvon users ----------
// Reads the people of a connected system again (nothing is invented), keeps the ones that can become users (active, with
// e-mail, not yet registered) and creates them in ALPHABETICAL order, up to the seats the company's plan still has
// (company_limits.max_users = NULL means unlimited). Everything the ewvon registry has is filled when the system sends it:
// profile columns + encrypted employee record (written with the admin's own session through set_employee_record).
const IMP: Record<string, string[]> = {
  email: ['email', 'emailcorporativo', 'emailtrabalho', 'workemail', 'emailprofissional', 'corporateemail', 'mail', 'emailaddress', 'useremail', 'emailcomercial', 'emailempresa', 'emailempresarial'],
  tel: ['telefone', 'celular', 'phone', 'mobile', 'cellphone', 'phonenumber', 'fone', 'whatsapp', 'telefonecelular', 'mobilephone', 'telefonecomercial', 'workphone', 'telefoneprincipal'],
  tel2: ['telefone2', 'telefonealternativo', 'celular2', 'phone2', 'altphone', 'telefonefixo', 'homephone', 'telefoneresidencial', 'telefonepessoal'],
  cpf: ['cpf', 'documentocpf', 'cpfnumber', 'numerocpf'],
  rg: ['rg', 'identidade', 'numerorg', 'documentorg', 'rgnumber', 'numeroidentidade'],
  rgorg: ['orgaoemissor', 'orgaoexpedidor', 'rgissuer', 'emissor', 'rgorgao', 'orgaoemissorrg'],
  pis: ['pis', 'pispasep', 'nispis', 'nis', 'pasep', 'numeropis'],
  ctps: ['ctps', 'carteiradetrabalho', 'numeroctps', 'ctpsnumero'],
  civil: ['estadocivil', 'maritalstatus', 'civilstatus'],
  esc: ['escolaridade', 'grauinstrucao', 'educationlevel', 'education', 'instrucao', 'grauescolaridade'],
  social: ['nomesocial', 'socialname', 'preferredname', 'apelido', 'nickname'],
  emailp: ['emailpessoal', 'personalemail', 'emailparticular'],
  cep: ['cep', 'zip', 'zipcode', 'postalcode', 'codigopostal'],
  rua: ['logradouro', 'rua', 'street', 'addressstreet', 'streetname', 'endereco', 'address'],
  num: ['numeroendereco', 'addressnumber', 'streetnumber', 'numerologradouro', 'numerocasa'],
  comp: ['complemento', 'complement', 'addresscomplement', 'addressline2'],
  bairro: ['bairro', 'district', 'neighborhood'],
  cidade: ['cidade', 'city', 'municipio', 'addresscity'],
  uf: ['uf', 'estado', 'state', 'addressstate'],
  gestor: ['gestor', 'gerente', 'supervisor', 'lider', 'manager', 'managername', 'chefe', 'superior', 'responsavel', 'reportsto', 'gestorimediato'],
  unid: ['unidade', 'branch', 'unit', 'localdetrabalho', 'worklocation', 'local'],
  jornada: ['jornada', 'cargahoraria', 'horassemanais', 'weeklyhours', 'workload', 'cargahorariasemanal'],
  ini: ['horarioentrada', 'entrada', 'inicioexpediente', 'workstart'],
  fim: ['horariosaida', 'saida', 'fimexpediente', 'workend'],
  emerg: ['contatoemergencia', 'emergencycontact', 'emergencyname', 'nomecontatoemergencia'],
  emergtel: ['telefoneemergencia', 'emergencyphone', 'telefonecontatoemergencia'],
  emergrel: ['parentescoemergencia', 'emergencyrelation', 'parentesco'],
};
const IMP_TAIL = ['email', 'cpf', 'pis', 'tel', 'cep'];
interface Person { key: string; name: string; email: string; dem: string | null; birth: string | null; depto: string; reg: string; phone: string; address: string; rec: Record<string, string> }
const digitsOf = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const fmtCpf = (v: unknown) => { const d = digitsOf(v); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : ''; };
const fmtPhone = (v: unknown) => { const d = digitsOf(v).replace(/^55(?=\d{10,11}$)/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : ''; };
const fmtTime = (v: unknown) => { const m = String(v ?? '').match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const fmtMoney = (n: number | null) => (n == null || n <= 0 ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const MARITAL: [RegExp, string][] = [[/solteir/i, 'Solteiro(a)'], [/casad/i, 'Casado(a)'], [/uni[aã]o|estavel|estável/i, 'União estável'], [/divorc|separad/i, 'Divorciado(a)'], [/vi[uú]v/i, 'Viúvo(a)']];
const EDU: [RegExp, string][] = [[/p[oó]s|mestr|doutor|especializ/i, 'Pós-graduação'], [/superior.*(incompleto)|incompleto.*superior|cursando/i, 'Superior incompleto'], [/superior|gradua/i, 'Superior completo'], [/m[eé]dio|2.? grau/i, 'Médio completo'], [/fundamental|1.? grau/i, 'Fundamental completo']];
const CONTRACT: [RegExp, string][] = [[/clt|celetist/i, 'CLT'], [/pj|jur[ií]dica/i, 'PJ'], [/est[aá]gi/i, 'Estágio'], [/tempor/i, 'Temporário'], [/aprendiz/i, 'Aprendiz']];
const pick = (v: string, list: [RegExp, string][]) => { for (const [re, out] of list) if (re.test(v)) return out; return ''; };

function mapPeople(recs: any[]): Person[] {
  const base = detectColumns(recs); const ext = detectColumns(recs, IMP, IMP_TAIL);
  const out: Person[] = []; const seen = new Set<string>();
  const txt = (v: unknown) => (v == null ? '' : String(v).trim());
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    const o: any = flat(r, '', {});
    if (o.name && o.last_name) o.name = `${o.name} ${o.last_name}`; else if (o.first_name && o.last_name) o.name = `${o.first_name} ${o.last_name}`;
    const g = (f: string) => base[f] ? o[base[f]] : undefined; const x = (f: string) => ext[f] ? o[ext[f]] : undefined;
    const name = txt(g('nome') ?? o.name); if (!name) continue;
    let email = txt(x('email')).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) email = '';
    const key = txt(g('xid')) || txt(g('km')) || `${norm(name)}|${toDate(g('adm')) ?? ''}`;
    const dedupe = email || key; if (seen.has(dedupe)) continue; seen.add(dedupe);
    const sex = txt(g('sexo')).toUpperCase().charAt(0); const wd = txt(x('jornada')).match(/\d+(?:[.,]\d+)?/);
    const street = txt(x('rua')), number = txt(x('num')), district = txt(x('bairro')), city = txt(x('cidade')), uf = txt(x('uf')).slice(0, 2).toUpperCase();
    const rec: Record<string, string> = {
      admission_date: toDate(g('adm')) || '', job_title: txt(g('cargo')), salary: fmtMoney(toNum(g('sal'))), registration: txt(g('km')),
      cpf: fmtCpf(x('cpf')), rg: txt(x('rg')).slice(0, 30), rg_issuer: txt(x('rgorg')).toUpperCase().slice(0, 20), pis: digitsOf(x('pis')).slice(0, 11), ctps: txt(x('ctps')).slice(0, 30),
      social_name: txt(x('social')).slice(0, 120), marital_status: pick(txt(x('civil')), MARITAL), education: pick(txt(x('esc')), EDU),
      sex: sex === 'M' || sex === 'F' ? sex : sex ? 'O' : '', phone_alt: fmtPhone(x('tel2')), personal_email: txt(x('emailp')).toLowerCase().slice(0, 120),
      emergency_name: txt(x('emerg')).slice(0, 120), emergency_relation: txt(x('emergrel')).slice(0, 60), emergency_phone: fmtPhone(x('emergtel')),
      zip: digitsOf(x('cep')).length === 8 ? digitsOf(x('cep')).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '', street: street.slice(0, 150), number: number.slice(0, 20), complement: txt(x('comp')).slice(0, 80), district: district.slice(0, 80), city: city.slice(0, 80), state: uf,
      unit: txt(x('unid')) || txt(g('kemp')), contract_type: pick(txt(g('ctr')), CONTRACT), manager_name: txt(x('gestor')).slice(0, 120),
      work_start: fmtTime(x('ini')), work_end: fmtTime(x('fim')), weekly_hours: wd ? wd[0].replace(',', '.') : '',
    };
    for (const k of Object.keys(rec)) if (!rec[k]) delete rec[k];
    out.push({ key, name: name.slice(0, 160), email, dem: toDate(g('dem')), birth: toDate(g('nasc')), depto: txt(g('depto')).slice(0, 80), reg: txt(g('km')).slice(0, 40), phone: fmtPhone(x('tel')), address: [street && (number ? `${street}, ${number}` : street), district, city && (uf ? `${city}/${uf}` : city)].filter(Boolean).join(' - ').slice(0, 250), rec });
  }
  return out;
}
const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) || a.email.localeCompare(b.email);

async function importPlan(companyId: string, row: any) {
  const cfg = cleanConfig(row.config); if (typeof cfg === 'string') throw new Error(cfg);
  const people = mapPeople(await fetchRecords(cfg, await open(row.secret_enc)));
  // Fill what the list lacks with the details already synced for the Dash (Convenia's list has no job/sex/contract),
  // and never import someone the synced data marks as dismissed.
  const { data: synced } = await admin.from('hr_employees').select('ext_key,cargo,sexo,ctr,adm,nasc,depto,dem').eq('source_id', row.id).limit(MAX_EMPLOYEES);
  const sy = new Map<string, any>((synced || []).map((r: any) => [String(r.ext_key), r]));
  for (const p of people) {
    const c = sy.get(p.key); if (!c) continue;
    if (c.dem && !p.dem) p.dem = c.dem;
    if (!p.rec.job_title && c.cargo) p.rec.job_title = String(c.cargo).slice(0, 120);
    const sx = String(c.sexo || '').toUpperCase().charAt(0); if (!p.rec.sex && (sx === 'M' || sx === 'F')) p.rec.sex = sx;
    if (!p.rec.contract_type && c.ctr) { const ct = pick(String(c.ctr), CONTRACT); if (ct) p.rec.contract_type = ct; }
    if (!p.rec.admission_date && c.adm) p.rec.admission_date = String(c.adm).slice(0, 10);
    if (!p.birth && c.nasc) p.birth = String(c.nasc).slice(0, 10);
    if (!p.depto && c.depto) p.depto = String(c.depto).slice(0, 80);
  }
  const active = people.filter((p) => !p.dem);
  const withEmail = active.filter((p) => p.email);
  const taken = new Set<string>();
  for (let i = 0; i < withEmail.length; i += 150) {
    const { data } = await admin.from('profiles').select('email').in('email', withEmail.slice(i, i + 150).map((p) => p.email));
    for (const r of data || []) taken.add(String(r.email).toLowerCase());
  }
  const eligible = withEmail.filter((p) => !taken.has(p.email)).sort(byName);
  const { data: lim } = await admin.rpc('company_limits', { _company_id: companyId });
  const max: number | null = (Array.isArray(lim) ? lim[0]?.max_users : (lim as any)?.max_users) ?? null;
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true).not('profile_type', 'in', '(system,bot)');
  const used = count ?? 0; const seats = max == null ? null : Math.max(0, max - used);
  return { people, active, eligible, max, used, seats, summary: { total: people.length, dismissed: people.length - active.length, withoutEmail: active.length - withEmail.length, alreadyRegistered: withEmail.length - eligible.length, eligible: eligible.length } };
}

const strongPassword = () => { const a = crypto.getRandomValues(new Uint8Array(18)); const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', S = '!@#$%&*?'; const all = L + U + D + S; return 'Aa1!' + Array.from(a, (b) => all[b % all.length]).join(''); };

async function importBatch(who: { userId: string; companyId: string }, jwt: string, row: any, mode: string) {
  const plan = await importPlan(who.companyId, row);
  const take = plan.seats == null ? plan.eligible.length : Math.min(plan.seats, plan.eligible.length);
  const queue = mode === 'all' ? plan.eligible.slice(0, take) : [];
  const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: secs } = await admin.from('sectors').select('id, name, is_general').eq('company_id', who.companyId);
  const sectors = new Map<string, string>((secs || []).map((s: any) => [norm(s.name), s.id]));
  const general = (secs || []).find((s: any) => s.is_general)?.id ?? null;
  const deadline = Date.now() + 100_000; let created = 0, failed = 0, newSectors = 0, limitHit = false, first = ''; const errors: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (Date.now() > deadline) break;
    let sectorId: string | null = general;
    if (p.depto) {
      const k = norm(p.depto);
      if (!sectors.has(k)) { const { data: ns } = await admin.from('sectors').insert({ company_id: who.companyId, name: p.depto }).select('id').single(); if (ns) { sectors.set(k, ns.id); newSectors++; } }
      sectorId = sectors.get(k) ?? general;
    }
    const { data: au, error: ae } = await admin.auth.admin.createUser({ email: p.email, password: strongPassword(), email_confirm: true, user_metadata: { name: p.name, display_name: p.name.split(' ')[0], company_id: who.companyId } });
    if (ae || !au?.user) { failed++; if (errors.length < 5) errors.push(`${p.name}: ${/already been registered/i.test(ae?.message || '') ? 'e-mail já cadastrado' : 'não foi possível criar o acesso'}`); continue; }
    const { error: pe } = await admin.from('profiles').update({ company_id: who.companyId, name: p.name, birth_date: p.birth, sector_id: sectorId, phone: p.phone || null, address: p.address || null, registration_number: p.reg || null, profile_type: 'user', autonomy_level: 'colaborador', is_active: true }).eq('user_id', au.user.id);
    if (pe) {
      await admin.auth.admin.deleteUser(au.user.id);
      if (String(pe.message).includes('LIMITE_USUARIOS')) { limitHit = true; break; }
      failed++; if (errors.length < 5) errors.push(`${p.name}: não foi possível salvar o perfil`); continue;
    }
    await admin.from('user_roles').insert({ user_id: au.user.id, role: 'colaborador' });
    const { data: prof } = await admin.from('profiles').select('id').eq('user_id', au.user.id).maybeSingle();
    if (prof?.id && Object.keys(p.rec).length) await userDb.rpc('set_employee_record', { _profile: prof.id, _data: p.rec });
    created++; if (!first) first = p.name;
  }
  // what is still waiting after this batch (the app calls again until nothing is pending)
  const pending = limitHit ? 0 : Math.max(0, queue.length - created - failed);
  return { ok: true, created, failed, newSectors, pending, limitHit, errors, summary: plan.summary };
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
        const every = Math.min(Math.max(Number(r.config?.every) || 60, MIN_EVERY), 60) * 60_000;
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
    if (route === 'import-preview') {
      const src = await own(body.id); if (!src) return reply({ error: 'Integração não encontrada.' }, 404);
      try {
        const p = await importPlan(who.companyId, src);
        const willImport = p.seats == null ? p.eligible.length : Math.min(p.seats, p.eligible.length);
        const inc = p.eligible.slice(0, willImport); const exc = p.eligible.slice(willImport);
        return reply({ ok: true, ...p.summary, limit: p.max, used: p.used, seats: p.seats, willImport, over: exc.length > 0, excluded: exc.length, firstName: inc[0]?.name || null, lastName: inc[inc.length - 1]?.name || null, firstExcluded: exc[0]?.name || null,
          fields: Array.from(new Set(inc.flatMap((x) => Object.keys(x.rec)))).length });
      } catch (e) { return reply({ error: (e as Error).message }, 400); }
    }
    if (route === 'import-run') {
      const src = await own(body.id); if (!src) return reply({ error: 'Integração não encontrada.' }, 404);
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      try { return reply(await importBatch(who, jwt, src, body.mode === 'all' ? 'all' : 'none')); } catch (e) { return reply({ error: (e as Error).message }, 400); }
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
