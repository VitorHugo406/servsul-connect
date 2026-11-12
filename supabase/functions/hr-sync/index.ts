// RH e Ponto -> Dash 3D. The admin picks the system (Convenia, Pontomais, Nexti, Ahgora, ...) and pastes the API key; the
// columns are recognised automatically (same synonym dictionary the original Dash used) and refreshed every minute.
// Or the system pushes records to us. One row per person ends up in hr_people_status.
//   POST /hr-sync/presets     company admin: list of supported systems
//   POST /hr-sync/save        company admin: { preset, url?, path?, header_name?, oauth_url?, every?, secret?, enabled }
//   POST /hr-sync/test        company admin: one call, recognised columns + preview, nothing is stored
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
  cargo: ['cargo', 'funcao', 'role', 'position', 'jobtitle', 'title', 'job'],
  sexo: ['sexo', 'genero', 'gender', 'sex'],
  adm: ['admissao', 'dataadmissao', 'dtadmissao', 'dataadm', 'hiredate', 'startdate', 'admissiondate', 'hiredon', 'dateofhire', 'admittedat', 'hiringdate', 'datacontratacao', 'dtcontratacao', 'contratacao', 'hireddate', 'startedat', 'contractstart'],
  dem: ['demissao', 'desligamento', 'datademissao', 'datadesligamento', 'dtdemissao', 'datadesl', 'terminationdate', 'enddate', 'termination', 'terminatedat', 'leavedate', 'dismissaldate', 'dismissal'],
  faltas: ['faltas', 'ausencias', 'faltasmes', 'absences', 'absence', 'absencecount'],
  he: ['horasextras', 'horaextra', 'horasextra', 'he', 'hrsextras', 'overtime', 'overtimehours'],
  kc: ['cpf', 'cpffuncionario', 'numerodocpf', 'taxid', 'documento'],
  km: ['matricula', 'matr', 'registro', 'chapa', 'codigofuncionario', 'employeeid', 'employeenumber', 'idfuncionario', 'registration'],
  ke: ['email', 'emailcorporativo', 'emailtrabalho', 'workemail', 'mail'],
  bat: ['batidas', 'batidashoje', 'qtdbatidas', 'punches', 'marcacoes', 'clockings', 'numerodebatidas'],
  atr: ['atrasos', 'atraso', 'minutosatraso', 'minutosatrasados', 'late', 'lateminutes', 'tardiness', 'atrasosmin'],
  bh: ['bancodehoras', 'saldobh', 'bancohoras', 'timebank', 'saldobancohoras', 'saldohoras'],
  nasc: ['nascimento', 'datanascimento', 'dtnascimento', 'birthdate', 'birthday'],
  ctr: ['tipocontrato', 'contrato', 'vinculo', 'regime', 'tipodevinculo', 'contracttype', 'employmenttype'],
  fv: ['feriasvencidas', 'diasferiasvencidas', 'feriasvencendo', 'overduevacation', 'vacationoverdue'],
  sit: ['situacao', 'statusfuncionario', 'situacaofuncionario', 'employmentstatus', 'situation', 'statusponto', 'situacaoponto'],
  cin: ['primeiraentrada', 'entrada', 'horaentrada', 'clockin', 'firstpunch', 'primeirabatida'],
};
const LABELS: Record<string, string> = { nome: 'Nome', depto: 'Departamento', cargo: 'Cargo', sexo: 'Sexo', adm: 'Admissão', dem: 'Demissão', faltas: 'Faltas', he: 'Horas extras', kc: 'CPF', km: 'Matrícula', ke: 'E-mail', bat: 'Batidas', atr: 'Atrasos', bh: 'Banco de horas', nasc: 'Nascimento', ctr: 'Contrato', fv: 'Férias vencidas', sit: 'Situação', cin: 'Entrada' };

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

interface Person { name: string; email: string; cpf: string; reg: string; status: Status | null; clock_in: string | null; bank: number | null; data: Record<string, unknown>; dismissed: boolean }
function mapStatus(raw: unknown): Status | null {
  const s = norm(raw); if (!s) return null;
  if (/ferias|vacation/.test(s)) return 'vacation';
  if (/afast|licenca|leave|atestado|inss/.test(s)) return 'leave';
  if (/falta|ausen|absent/.test(s)) return 'absent';
  if (/atras|late/.test(s)) return 'late';
  if (/presente|present|trabalhando|emexpediente/.test(s)) return 'present';
  if (/folga|dayoff|descanso/.test(s)) return 'off';
  return null;
}
function detectColumns(recs: any[]): Record<string, string> {
  const keys = new Map<string, string>();            // normalised flattened key -> original flattened key
  for (const r of recs.slice(0, 30)) if (r && typeof r === 'object') for (const k of Object.keys(flat(r, '', {}))) { const n = norm(k); if (n && !keys.has(n)) keys.set(n, k); }
  const map: Record<string, string> = {};
  for (const f in SYN) for (const syn of SYN[f]) { if (keys.has(syn)) { map[f] = keys.get(syn)!; break; } }
  return map;
}
function mapPeople(recs: any[]): { people: Person[]; columns: Record<string, string> } {
  const columns = detectColumns(recs); const now = Date.now(); const people: Person[] = [];
  for (const r of recs) {
    if (!r || typeof r !== 'object') continue;
    const o = flat(r, '', {}); if ((o as any).name && (o as any).last_name) { (o as any).name = `${(o as any).name} ${(o as any).last_name}`; }
    else if ((o as any).first_name && (o as any).last_name) { (o as any).name = `${(o as any).first_name} ${(o as any).last_name}`; }
    const g = (f: string) => columns[f] ? o[columns[f]] : undefined;
    const dem = toIso(g('dem'));
    const data: Record<string, unknown> = {};
    const put = (k: string, v: unknown) => { if (v != null && v !== '') data[k] = v; };
    put('depto', g('depto') != null ? String(g('depto')) : null); put('cargo', g('cargo') != null ? String(g('cargo')) : null); put('sexo', g('sexo') != null ? String(g('sexo')) : null);
    put('adm', toDate(g('adm'))); put('nasc', toDate(g('nasc'))); put('ctr', g('ctr') != null ? String(g('ctr')) : null);
    put('faltas', toNum(g('faltas'))); put('he', toNum(g('he'))); put('atr', toNum(g('atr'))); put('bat', toNum(g('bat'))); put('fv', toNum(g('fv')));
    const bank = toMinutes(g('bh'));
    people.push({
      name: String(g('nome') ?? (o as any).name ?? '').trim(), email: String(g('ke') ?? '').trim().toLowerCase(), cpf: String(g('kc') ?? '').replace(/\D/g, ''), reg: String(g('km') ?? '').trim().toLowerCase(),
      status: mapStatus(g('sit')), clock_in: toIso(g('cin')), bank, data, dismissed: !!dem && new Date(dem).getTime() <= now,
    });
  }
  return { people, columns };
}

async function profileIndex(companyId: string) {
  const { data } = await admin.from('profiles').select('id, name, display_name, email, cpf, registration_number').eq('company_id', companyId).eq('is_active', true).neq('profile_type', 'system').limit(5000);
  const by = { email: new Map<string, string>(), cpf: new Map<string, string>(), reg: new Map<string, string>(), name: new Map<string, string | null>() };
  for (const p of data || []) {
    const e = String(p.email || '').trim().toLowerCase(); if (e) by.email.set(e, p.id);
    const c = String(p.cpf || '').replace(/\D/g, ''); if (c) by.cpf.set(c, p.id);
    const r = String(p.registration_number || '').trim().toLowerCase(); if (r) by.reg.set(r, p.id);
    for (const nm of [p.name, p.display_name]) { const n = norm(nm); if (n) by.name.set(n, by.name.has(n) && by.name.get(n) !== p.id ? null : p.id); }   // null = ambiguous
  }
  return by;
}
type Index = Awaited<ReturnType<typeof profileIndex>>;
const matchProfile = (idx: Index, p: Person): string | undefined =>
  (p.email && idx.email.get(p.email)) || (p.cpf && idx.cpf.get(p.cpf)) || (p.reg && idx.reg.get(p.reg)) || (p.name ? (idx.name.get(norm(p.name)) ?? undefined) : undefined) || undefined;

interface Row { profile_id: string; status: Status | null; clock_in: string | null; bank: number | null; data: Record<string, unknown> }
async function applyRows(companyId: string, source: string, rows: Row[], replaceAll: boolean, startedAt: string) {
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ company_id: companyId, profile_id: r.profile_id, source, status: r.status, clock_in: r.clock_in, hours_bank_minutes: r.bank, data: r.data, synced_at: now }));
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
    const recs = await fetchRecords(cfg, await open(row.secret_enc));
    const { people, columns } = mapPeople(recs);
    if (!columns.nome && !columns.ke && !columns.kc && !columns.km) throw new Error('Não reconheci nenhuma coluna que identifique a pessoa (nome, e-mail, CPF ou matrícula). Confira o caminho da lista em Opções avançadas.');
    const idx = await profileIndex(companyId); const rows: Row[] = [];
    let unmatched = 0, dismissed = 0;
    for (const p of people) {
      if (p.dismissed) { dismissed++; continue; }
      const pid = matchProfile(idx, p); if (!pid) { unmatched++; continue; }
      rows.push({ profile_id: pid, status: p.status, clock_in: p.clock_in, bank: p.bank, data: p.data });
    }
    if (people.length > 0 && rows.length === 0) throw new Error('Nenhuma pessoa do sistema foi reconhecida no ewvon. Os cadastros precisam ter o mesmo e-mail, CPF, matrícula ou nome.');
    await applyRows(companyId, 'api', rows, true, startedAt);
    await admin.from('company_integrations').update({ last_status: 'ok', last_error: null, last_used_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: true, total: people.length, matched: rows.length, unmatched, dismissed, columns: Object.keys(columns).map((k) => LABELS[k] || k) };
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
        const every = Math.min(Math.max(Number(r.config?.every) || 1, 1), 60) * 60_000;
        if (r.last_used_at && Date.now() - new Date(r.last_used_at).getTime() < every - 8_000) continue;
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
      const rows: Row[] = [];
      let unmatched = 0, invalid = 0;
      for (const r of recs) {
        const person: Person = { name: String(r?.name ?? r?.nome ?? '').trim(), email: String(r?.email ?? '').trim().toLowerCase(), cpf: String(r?.cpf ?? '').replace(/\D/g, ''), reg: String(r?.registration ?? r?.matricula ?? '').trim().toLowerCase(), status: null, clock_in: toIso(r?.clock_in), bank: r?.hours_bank_minutes != null ? Math.round(Number(r.hours_bank_minutes)) : null, data: {}, dismissed: false };
        const st = String(r?.status ?? '');
        if (st) { if ((STATUSES as readonly string[]).includes(st)) person.status = st as Status; else { invalid++; continue; } }
        for (const k2 of ['depto', 'cargo', 'sexo', 'ctr']) if (r?.[k2] != null) person.data[k2] = String(r[k2]);
        for (const k2 of ['faltas', 'he', 'atr', 'bat', 'fv']) { const n = toNum(r?.[k2]); if (n != null) person.data[k2] = n; }
        const pid = matchProfile(idx, person); if (!pid) { unmatched++; continue; }
        rows.push({ profile_id: pid, status: person.status, clock_in: person.clock_in, bank: person.bank, data: person.data });
      }
      await applyRows(m[1], 'push', rows, false, new Date().toISOString());
      return reply({ ok: true, received: recs.length, stored: rows.length, unmatched, invalid });
    }

    const who = await companyAdmin(req);
    if (!who) return reply({ error: 'Somente o administrador da empresa configura esta integração.' }, 403);
    const body = await req.json().catch(() => ({}));
    const { data: existing } = await admin.from('company_integrations').select('id, company_id, config, secret_enc, enabled').eq('company_id', who.companyId).eq('provider', 'hr').maybeSingle();

    if (route === 'presets') {
      return reply({ ok: true, presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, cat: p.cat, needsUrl: p.needsUrl, auth: p.auth, header: p.header || null, tokenLabel: p.tokenLabel, note: p.note, url: p.url || null, path: p.path })) });
    }
    if (route === 'save') {
      const cfg = cleanConfig(body); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secret = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : undefined;
      if (!secret && !existing?.secret_enc) return reply({ error: 'Cole a chave (token) da API.' }, 400);
      const row: any = { company_id: who.companyId, provider: 'hr', enabled: body.enabled !== false, events: [], config: cfg, updated_by: who.userId, updated_at: new Date().toISOString() };
      if (secret) row.secret_enc = await seal(secret);
      const { error } = await admin.from('company_integrations').upsert(row, { onConflict: 'company_id,provider' });
      if (error) return reply({ error: 'Não foi possível salvar.' }, 500);
      // first load right away so the admin sees the result without waiting for the next minute
      const saved = await admin.from('company_integrations').select('id, company_id, config, secret_enc').eq('company_id', who.companyId).eq('provider', 'hr').maybeSingle();
      const first = saved.data ? await runSync(who.companyId, saved.data) : null;
      return reply({ ok: true, first });
    }
    if (route === 'test') {
      const cfg = cleanConfig(body.preset ? body : existing?.config); if (typeof cfg === 'string') return reply({ error: cfg }, 400);
      const secretIn = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : (existing?.secret_enc ? await open(existing.secret_enc) : '');
      if (!secretIn) return reply({ error: 'Cole a chave (token) da API.' }, 400);
      try {
        const { people, columns } = mapPeople(await fetchRecords(cfg, secretIn));
        const idx = await profileIndex(who.companyId);
        const active = people.filter((x) => !x.dismissed);
        const matched = active.filter((x) => matchProfile(idx, x)).length;
        const mask = (n: string) => n.replace(/^(.{2}).*$/, '$1***');
        const sample = active.slice(0, 3).map((x) => ({ name: x.name ? mask(x.name) : '', matched: !!matchProfile(idx, x), depto: x.data.depto ?? null, status: x.status }));
        return reply({ ok: true, total: people.length, active: active.length, matched, unmatched: active.length - matched, columns: Object.keys(columns).map((k) => LABELS[k] || k), sample });
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
