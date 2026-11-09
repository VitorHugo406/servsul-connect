// Replaces the Supabase client's network methods with a localStorage store while a demo session is active.
import { DEMO_DATA_PREFIX, DemoSession, endDemoSession } from './demoSession';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';
type Row = Record<string, any>;

const tableKey = (t: string) => `${DEMO_DATA_PREFIX}${t}`;
export function readTable(t: string): Row[] { try { return JSON.parse(localStorage.getItem(tableKey(t)) || '[]'); } catch { return []; } }
function writeTable(t: string, rows: Row[]) { try { localStorage.setItem(tableKey(t), JSON.stringify(rows)); } catch { /* quota */ } notify(t); }

const listeners = new Set<(table: string) => void>();
function notify(t: string) { listeners.forEach(l => { try { l(t); } catch { /* ignore */ } }); }

function seed(s: DemoSession) {
  if (localStorage.getItem(`${DEMO_DATA_PREFIX}seeded`)) return;
  const now = new Date().toISOString();
  writeTable('companies', [{ id: s.companyId, name: 'Empresa Teste', slug: 'teste', logo_url: null, primary_color: '#000000', secondary_color: '#FFFFFF', is_active: true, is_system: false, enabled_modules: ['bh', 'bi', 'fechamento', 'orbs'], created_at: now }]);
  writeTable('sectors', [{ id: GERAL_SECTOR_ID, name: 'Geral', color: '#000000', icon: 'Users', company_id: s.companyId, created_at: now }]);
  writeTable('profiles', [{ id: s.profileId, user_id: s.userId, name: 'Usuário Teste', display_name: 'Usuário Teste', email: 'teste@nuvexa.demo', avatar_url: null, sector_id: GERAL_SECTOR_ID, autonomy_level: 'admin', birth_date: null, is_active: true, profile_type: 'user', created_at: now, updated_at: now, last_seen_at: now, user_status: 'online', work_period: null, company_id: s.companyId, team_alerts_enabled: false, team_alert_times: [] }]);
  writeTable('user_roles', [{ id: crypto.randomUUID(), user_id: s.userId, role: 'admin' }]);
  writeTable('user_permissions', [{ id: crypto.randomUUID(), user_id: s.userId, can_post_announcements: true, can_delete_messages: true, can_access_management: true, can_access_password_change: true, can_create_war_room: true, can_access_bh: true, can_access_fechamento: true, can_access_orbs: true, can_access_meeting_rooms: true }]);
  localStorage.setItem(`${DEMO_DATA_PREFIX}seeded`, '1');
}

type Filter = (r: Row) => boolean;
const cmp = (a: any, b: any) => (a == null ? -1 : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0);
const likeRe = (p: string, ci: boolean) => new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', ci ? 'i' : '');

function parseOr(expr: string): Filter {
  const parts = expr.split(',').map(p => p.trim()).filter(Boolean);
  const fs = parts.map(p => { const [col, op, ...rest] = p.split('.'); const v = rest.join('.'); return opFilter(col, op, v); });
  return r => fs.some(f => f(r));
}
function opFilter(col: string, op: string, v: any): Filter {
  const val = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
  switch (op) {
    case 'eq': return r => String(r[col]) === String(val);
    case 'neq': return r => String(r[col]) !== String(val);
    case 'is': return r => (val === null ? r[col] == null : r[col] === val);
    case 'gt': return r => cmp(r[col], val) > 0;
    case 'gte': return r => cmp(r[col], val) >= 0;
    case 'lt': return r => cmp(r[col], val) < 0;
    case 'lte': return r => cmp(r[col], val) <= 0;
    case 'like': return r => likeRe(val, false).test(String(r[col] ?? ''));
    case 'ilike': return r => likeRe(val, true).test(String(r[col] ?? ''));
    case 'in': { const list = String(val).replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/"/g, '')); return r => list.includes(String(r[col])); }
    default: return () => true;
  }
}

class Query implements PromiseLike<any> {
  private filters: Filter[] = []; private orders: { col: string; asc: boolean }[] = [];
  private lim?: number; private from_?: number; private to_?: number; private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any; private single_: 'one' | 'maybe' | null = null; private returning = false; private countOpt = false; private head = false; private onConflict?: string;
  constructor(private table: string, private s: DemoSession) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { if (this.mode !== 'select') this.returning = true; if (opts?.count) this.countOpt = true; if (opts?.head) this.head = true; return this; }
  insert(v: any) { this.mode = 'insert'; this.payload = v; return this; }
  upsert(v: any, o?: { onConflict?: string }) { this.mode = 'upsert'; this.payload = v; this.onConflict = o?.onConflict; return this; }
  update(v: any) { this.mode = 'update'; this.payload = v; return this; }
  delete() { this.mode = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push(opFilter(c, 'eq', v === null ? 'null' : v)); return this; }
  neq(c: string, v: any) { this.filters.push(opFilter(c, 'neq', v)); return this; }
  is(c: string, v: any) { this.filters.push(opFilter(c, 'is', v === null ? 'null' : v)); return this; }
  gt(c: string, v: any) { this.filters.push(opFilter(c, 'gt', v)); return this; }
  gte(c: string, v: any) { this.filters.push(opFilter(c, 'gte', v)); return this; }
  lt(c: string, v: any) { this.filters.push(opFilter(c, 'lt', v)); return this; }
  lte(c: string, v: any) { this.filters.push(opFilter(c, 'lte', v)); return this; }
  like(c: string, v: any) { this.filters.push(opFilter(c, 'like', v)); return this; }
  ilike(c: string, v: any) { this.filters.push(opFilter(c, 'ilike', v)); return this; }
  in(c: string, v: any[]) { const set = (v || []).map(String); this.filters.push(r => set.includes(String(r[c]))); return this; }
  contains(c: string, v: any) { this.filters.push(r => Array.isArray(r[c]) && (Array.isArray(v) ? v : [v]).every((x: any) => r[c].includes(x))); return this; }
  overlaps(c: string, v: any[]) { this.filters.push(r => Array.isArray(r[c]) && v.some(x => r[c].includes(x))); return this; }
  match(o: Row) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this; }
  not(c: string, op: string, v: any) { const f = opFilter(c, op, v === null ? 'null' : v); this.filters.push(r => !f(r)); return this; }
  filter(c: string, op: string, v: any) { this.filters.push(opFilter(c, op, v)); return this; }
  or(expr: string) { try { this.filters.push(parseOr(expr)); } catch { /* ignore */ } return this; }
  textSearch() { return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.to_ = b; return this; }
  single() { this.single_ = 'one'; return this; }
  maybeSingle() { this.single_ = 'maybe'; return this; }
  abortSignal() { return this; }
  returns() { return this; }
  throwOnError() { return this; }
  private defaults(r: Row): Row {
    const now = new Date().toISOString();
    const base: Row = { id: crypto.randomUUID(), created_at: now, updated_at: now };
    if (['profiles', 'sectors', 'task_boards', 'announcements', 'meeting_rooms', 'teams', 'war_rooms', 'notes'].includes(this.table)) base.company_id = this.s.companyId;
    return { ...base, ...r };
  }
  private run(): { data: any; error: any; count?: number } {
    let rows = readTable(this.table);
    const match = (r: Row) => this.filters.every(f => f(r));
    let out: Row[] = [];
    if (this.mode === 'insert' || this.mode === 'upsert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(r => this.defaults(r));
      for (const it of items) {
        const keys = this.mode === 'upsert' ? (this.onConflict ? this.onConflict.split(',').map(k => k.trim()) : ['id']) : ['id'];
        const idx = this.mode === 'upsert' ? rows.findIndex(r => keys.every(k => it[k] !== undefined && String(r[k]) === String(it[k]))) : -1;
        if (idx >= 0) { rows[idx] = { ...rows[idx], ...it, id: rows[idx].id, created_at: rows[idx].created_at }; out.push(rows[idx]); } else { rows.push(it); out.push(it); }
      }
      writeTable(this.table, rows);
    } else if (this.mode === 'update') {
      const now = new Date().toISOString();
      rows = rows.map(r => { if (!match(r)) return r; const n = { ...r, ...this.payload, updated_at: now }; out.push(n); return n; });
      writeTable(this.table, rows);
    } else if (this.mode === 'delete') {
      out = rows.filter(match); writeTable(this.table, rows.filter(r => !match(r)));
    } else {
      out = rows.filter(match);
    }
    for (const o of [...this.orders].reverse()) out.sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    const count = out.length;
    if (this.from_ !== undefined) out = out.slice(this.from_, (this.to_ ?? out.length) + 1);
    if (this.lim !== undefined) out = out.slice(0, this.lim);
    if (this.mode !== 'select' && !this.returning) return { data: null, error: null, count };
    if (this.head) return { data: null, error: null, count };
    if (this.single_) {
      if (out.length === 0) return this.single_ === 'maybe' ? { data: null, error: null } : { data: null, error: { message: 'Nenhum registro encontrado', code: 'PGRST116' } };
      return { data: out[0], error: null, count };
    }
    return { data: out, error: null, count: this.countOpt ? count : undefined };
  }
  then<T1 = any, T2 = never>(ok?: ((v: any) => T1 | PromiseLike<T1>) | null, fail?: ((e: any) => T2 | PromiseLike<T2>) | null): Promise<T1 | T2> {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }
}

function rpc(s: DemoSession, name: string, args: Row = {}) {
  const profiles = readTable('profiles');
  const me = profiles.find(p => p.user_id === s.userId);
  switch (name) {
    case 'get_my_full_profile': return { data: me ? [me] : [], error: null };
    case 'admin_list_profiles_full': return { data: profiles, error: null };
    case 'get_board_tasks_fast': return { data: readTable('tasks').filter(t => t.board_id === args._board_id), error: null };
    case 'get_board_task_details_fast': {
      const ids = new Set(readTable('tasks').filter(t => t.board_id === args._board_id).map(t => t.id));
      const pick = (t: string) => readTable(t).filter(r => ids.has(r.task_id));
      return { data: { labels: readTable('task_labels').filter(l => l.board_id === args._board_id), label_assignments: pick('task_label_assignments'), subtasks: pick('task_subtasks'), assignees: pick('task_assignees'), comments: pick('task_comments'), attachments: pick('task_attachments') }, error: null };
    }
    case 'reorder_board_tasks_fast': {
      const updates: Row[] = Array.isArray(args._updates) ? args._updates : [];
      const rows = readTable('tasks').map(t => { const u = updates.find(x => x.id === t.id); return u ? { ...t, ...u } : t; });
      writeTable('tasks', rows); return { data: updates.length, error: null };
    }
    case 'get_profiles_registration': return { data: profiles.filter(p => (args._ids || []).includes(p.id)).map(p => ({ id: p.id, registration_number: p.registration_number ?? null })), error: null };
    case 'current_company_id': return { data: s.companyId, error: null };
    case 'get_my_company_plan': return { data: { company_id: s.companyId, is_system: true, status: 'exempt', plan_id: null, plan_name: 'Demonstração', billing_cycle: 'monthly', current_period_end: null, has_auto_renewal: false, features: ['*'], price_cents: null, annual_price_cents: null, extra_users: 0, extra_storage_gb: 0, free_seats: 0, limits: { users: null, sectors: null, storage_bytes: null }, usage: { users: profiles.length, sectors: readTable('sectors').length, storage_bytes: 0 }, prices: null }, error: null };
    case 'is_admin': case 'is_super_admin': return { data: true, error: null };
    case 'is_support_staff': case 'can_manage_chat': return { data: true, error: null };
    case 'support_list_tickets': {
      const companies = readTable('companies');
      return { data: readTable('support_tickets').map((t): Row => { const p = profiles.find(x => x.id === t.profile_id); return { ...t, company_name: companies.find(c => c.id === t.company_id)?.name ?? 'Empresa Teste', reporter_id: t.profile_id, reporter_name: p?.display_name || p?.name || 'Usuário', reporter_email: p?.email || '' }; }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), error: null };
    }
    case 'support_update_ticket': {
      let out: Row | null = null;
      const rows = readTable('support_tickets').map(t => {
        if (String(t.id) !== String(args._id)) return t;
        out = { ...t, status: args._status ?? t.status, updated_at: new Date().toISOString(), ...(args._take ? { assignee_profile_id: me?.id, assignee_name: me?.display_name || me?.name } : {}) };
        return out;
      });
      writeTable('support_tickets', rows); return { data: out, error: out ? null : { message: 'ticket not found' } };
    }
    case 'support_ticket_info': {
      const t = readTable('support_tickets').find(x => String(x.id) === String(args._id));
      return { data: t ? [{ status: t.status, rating: t.rating ?? null, rating_comment: t.rating_comment ?? null, rated_at: t.rated_at ?? null, assignee_name: t.assignee_name ?? null, is_reporter: t.profile_id === me?.id }] : [], error: null };
    }
    case 'support_rate_ticket': {
      const rows = readTable('support_tickets').map(t => (String(t.id) === String(args._id) ? { ...t, rating: args._rating, rating_comment: args._comment ?? null, rated_at: new Date().toISOString() } : t));
      writeTable('support_tickets', rows); return { data: null, error: null };
    }
    case 'evaluation_respond': {
      let out: Row | null = null; const now = new Date().toISOString();
      const rows = readTable('evaluations').map(e => {
        if (e.id !== args._id || e.evaluated_id !== me?.id || e.status !== 'sent') return e;
        out = { ...e, status: args._accept ? 'finalized' : 'contested', evaluated_comment: args._comment || null, responded_at: now, finalized_at: args._accept ? now : null, acknowledged_at: args._accept ? now : null };
        return out;
      });
      writeTable('evaluations', rows); return { data: out, error: out ? null : { message: 'Esta avaliação não está aguardando sua ciência' } };
    }
    default: return { data: null, error: null };
  }
}

function fakeChannel() {
  const ch: any = { on: () => ch, subscribe: (cb?: (st: string) => void) => { setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch; }, unsubscribe: async () => 'ok', send: async () => 'ok', track: async () => 'ok', untrack: async () => 'ok', presenceState: () => ({}) };
  return ch;
}

const fileToDataUrl = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

function storageBucket(bucket: string) {
  const key = (p: string) => `${bucket}/${p}`;
  const files = () => readTable('__storage');
  return {
    upload: async (path: string, file: Blob) => { try { const url = await fileToDataUrl(file); const rows = files().filter(f => f.key !== key(path)); rows.push({ id: crypto.randomUUID(), key: key(path), url, size: (file as any).size ?? 0 }); writeTable('__storage', rows); return { data: { path, fullPath: key(path) }, error: null }; } catch (e: any) { return { data: null, error: { message: 'Arquivo grande demais para o modo teste' } }; } },
    getPublicUrl: (path: string) => ({ data: { publicUrl: files().find(f => f.key === key(path))?.url || '' } }),
    createSignedUrl: async (path: string) => ({ data: { signedUrl: files().find(f => f.key === key(path))?.url || '' }, error: null }),
    createSignedUrls: async (paths: string[]) => ({ data: paths.map(p => ({ path: p, signedUrl: files().find(f => f.key === key(p))?.url || '', error: null })), error: null }),
    download: async (path: string) => { const u = files().find(f => f.key === key(path))?.url; if (!u) return { data: null, error: { message: 'not found' } }; return { data: await (await fetch(u)).blob(), error: null }; },
    remove: async (paths: string[]) => { writeTable('__storage', files().filter(f => !paths.map(key).includes(f.key))); return { data: [], error: null }; },
    list: async () => ({ data: [], error: null }),
    update: async (path: string, file: Blob) => storageBucket(bucket).upload(path, file),
  };
}

const set = (o: any, k: string, v: any) => Object.defineProperty(o, k, { value: v, configurable: true, writable: true });

export function installDemoClient(client: any, s: DemoSession) {
  seed(s);
  const user = { id: s.userId, email: 'teste@nuvexa.demo', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { name: 'Usuário Teste' }, created_at: new Date(s.startedAt).toISOString() };
  const session = { access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 10800, expires_at: Math.floor(s.expiresAt / 1000), user };
  client.from = (t: string) => new Query(t, s);
  client.schema = () => client;
  client.rpc = async (n: string, a?: Row) => rpc(s, n, a);
  client.channel = () => fakeChannel();
  client.removeChannel = async () => 'ok';
  client.removeAllChannels = async () => [];
  client.getChannels = () => [];
  set(client, 'functions', { invoke: async () => ({ data: { success: true, demo: true }, error: null }) });
  set(client, 'storage', { from: (b: string) => storageBucket(b), listBuckets: async () => ({ data: [], error: null }) });
  set(client, 'auth', {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: (cb: (e: string, s: any) => void) => { setTimeout(() => cb('SIGNED_IN', session), 0); return { data: { subscription: { unsubscribe: () => {} } } }; },
    signInWithPassword: async () => ({ data: { user, session }, error: null }),
    signOut: async () => { endDemoSession('ended'); return { error: null }; },
    updateUser: async () => ({ data: { user }, error: null }),
    verifyOtp: async () => ({ data: { user, session }, error: null }),
    refreshSession: async () => ({ data: { session, user }, error: null }),
    setSession: async () => ({ data: { session, user }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  });
}
