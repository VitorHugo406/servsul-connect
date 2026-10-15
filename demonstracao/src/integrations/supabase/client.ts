/* Cliente isolado da demonstração. Não usa rede nem Supabase: todos os dados ficam neste navegador. */
type Row = Record<string, any>;
const PREFIX = "nuvexa-local-demo:v1:";
const listeners = new Set<(event: any) => void>();
const read = (key: string): Row[] => {
 try {
  const v = localStorage.getItem(PREFIX + key);
  if (v) return JSON.parse(v);
  const seeds: Record<string, Row[]> = {
   companies: [{ id:"demo-company", name:"Nuvexa", slug:"nuvexa", logo_url:null, primary_color:"#172554", secondary_color:"#2563eb", is_active:true, is_system:true, enabled_modules:[] }],
   sectors: [{ id:"00000000-0000-0000-0000-000000000001", name:"Geral", color:"#2563eb", icon:"building-2" }],
   profiles: [{ id:"demo-profile", user_id:"demo-user", name:"Vitor Hugo", display_name:"Vitor Hugo", email:"demo@nuvexa.local", avatar_url:null, sector_id:"00000000-0000-0000-0000-000000000001", autonomy_level:"admin", is_active:true, profile_type:"admin", company_id:"demo-company", created_at:new Date(0).toISOString(), updated_at:new Date().toISOString(), team_alerts_enabled:false, team_alert_times:[] }],
   user_roles: [{ id:"demo-role", user_id:"demo-user", role:"admin" }],
   user_permissions: [{ user_id:"demo-user", can_post_announcements:true, can_delete_messages:true, can_access_management:true, can_access_password_change:true, can_create_war_room:true, can_access_bh:true, can_access_fechamento:true, can_access_orbs:true }]
  };
  return seeds[key] ?? [];
 } catch { return []; }
}
const write = (key: string, rows: Row[]) => { try { localStorage.setItem(PREFIX + key, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("nuvexa-local-change", { detail: { table: key } })); } catch (e) { console.error("Não foi possível salvar dados da demonstração", e); } };
const uid = () => globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const matches = (row: Row, filters: Array<(r: Row) => boolean>) => filters.every(fn => fn(row));
const makeQuery = (table: string) => {
 let action = "select"; let payload: any; let columns = "*"; let filters: Array<(r: Row) => boolean> = []; let sort: { key: string; ascending: boolean } | null = null; let maxRows: number | null = null; let single = false;
 const run = async () => {
   let rows = read(table);
   if (action === "insert") { const items = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({ id: r.id ?? uid(), created_at: r.created_at ?? new Date().toISOString(), ...r })); write(table, [...rows, ...items]); rows = items; }
   else if (action === "upsert") { const items = (Array.isArray(payload) ? payload : [payload]).map((r: Row) => ({ id: r.id ?? uid(), ...r })); for (const item of items) { const i = rows.findIndex(r => r.id === item.id); if (i >= 0) rows[i] = { ...rows[i], ...item }; else rows.push(item); } write(table, rows); rows = items; }
   else if (action === "update") { const changed: Row[] = []; rows = rows.map(r => { if (matches(r, filters)) { const next = { ...r, ...payload }; changed.push(next); return next; } return r; }); write(table, rows); rows = changed; }
   else if (action === "delete") { const removed = rows.filter(r => matches(r, filters)); write(table, rows.filter(r => !matches(r, filters))); rows = removed; }
   else { rows = rows.filter(r => matches(r, filters)); if (sort) rows.sort((a,b) => (a[sort!.key] > b[sort!.key] ? 1 : a[sort!.key] < b[sort!.key] ? -1 : 0) * (sort!.ascending ? 1 : -1)); if (maxRows !== null) rows = rows.slice(0,maxRows); if (columns !== "*" && columns.trim()) { const keys = columns.split(",").map(s => s.trim().split(":").pop()!.trim()).filter(k => k && !k.includes("(")); rows = rows.map(r => Object.fromEntries(keys.filter(k => k in r).map(k => [k,r[k]]))); } }
   if (single) return { data: rows[0] ?? null, error: null, count: rows.length };
   return { data: rows, error: null, count: rows.length };
 };
 const q: any = {
  select: (c = "*") => { columns = c; return q; }, insert: (v: any) => { action="insert"; payload=v; return q; }, upsert: (v: any) => { action="upsert"; payload=v; return q; }, update: (v: any) => { action="update"; payload=v; return q; }, delete: () => { action="delete"; return q; },
  eq: (k: string,v: any) => { filters.push(r => r[k] === v); return q; }, neq: (k: string,v: any) => { filters.push(r => r[k] !== v); return q; }, is: (k: string,v: any) => { filters.push(r => r[k] === v); return q; }, in: (k: string,vs: any[]) => { filters.push(r => vs.includes(r[k])); return q; }, not: (k: string,op: string,v: any) => { filters.push(r => op === "is" ? r[k] !== v : r[k] !== v); return q; }, ilike: (k: string,v: string) => { const needle=v.replace(/%/g,"").toLowerCase(); filters.push(r => String(r[k] ?? "").toLowerCase().includes(needle)); return q; }, like: (k: string,v: string) => { const needle=v.replace(/%/g,"").toLowerCase(); filters.push(r => String(r[k] ?? "").toLowerCase().includes(needle)); return q; }, or: () => q, filter: () => q,
  order: (k: string,opts?: any) => { sort={key:k,ascending:opts?.ascending !== false}; return q; }, limit: (n: number) => { maxRows=n; return q; }, range: (a: number,b: number) => { maxRows=b-a+1; return q; }, single: () => { single=true; return q; }, maybeSingle: () => { single=true; return q; },
  then: (resolve: any,reject: any) => run().then(resolve,reject)
 };
 return q;
};
const DEMO_USER: any = { id: "demo-user", email: "demo@nuvexa.local", user_metadata: { name: "Vitor Hugo", full_name: "Vitor Hugo" }, app_metadata: { provider: "local" }, aud: "authenticated", role: "authenticated", created_at: new Date(0).toISOString() };
let session: any = null;
const authListeners = new Set<(event: string, session: any) => void>();
const emitAuth = (event: string) => authListeners.forEach(fn => fn(event, session));
const auth: any = {
 getSession: async () => ({ data: { session }, error: null }),
 getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
 onAuthStateChange: (cb: any) => { authListeners.add(cb); return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } }; },
 signInWithPassword: async ({ email }: any) => { const user = { ...DEMO_USER, email: email || DEMO_USER.email }; session = { access_token: "local-demo-token", refresh_token: "local-demo-refresh", token_type: "bearer", expires_in: 10800, expires_at: Math.floor(Date.now()/1000)+10800, user }; try { localStorage.setItem(PREFIX+"session", JSON.stringify(session)); } catch {} emitAuth("SIGNED_IN"); return { data: { user, session }, error: null }; },
 signUp: async ({ email }: any) => auth.signInWithPassword({ email }),
 signOut: async () => { session=null; try { localStorage.removeItem(PREFIX+"session"); } catch {} emitAuth("SIGNED_OUT"); return { error: null }; },
 refreshSession: async () => ({ data: { session }, error: null }), setSession: async () => ({ data: { session }, error: null }), resetPasswordForEmail: async () => ({ data: {}, error: null }), updateUser: async ({ data }: any) => ({ data: { user: { ...DEMO_USER, user_metadata: { ...DEMO_USER.user_metadata, ...data } } }, error: null })
};
try { const saved = localStorage.getItem(PREFIX+"session"); if (saved) session = JSON.parse(saved); } catch {}
const supabase: any = {
 from: (table: string) => makeQuery(table),
 auth,
 rpc: async (name: string, args?: any) => {
  if (name === "get_my_full_profile") return { data: [{ id: "demo-profile", user_id: session?.user?.id ?? DEMO_USER.id, name: session?.user?.user_metadata?.name ?? "Vitor Hugo", display_name: "Vitor Hugo", email: session?.user?.email ?? DEMO_USER.email, avatar_url: null, sector_id: null, autonomy_level: "admin", birth_date: null, is_active: true, profile_type: "admin", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen_at: null, user_status: "online", work_period: null, company_id: "demo-company", team_alerts_enabled: false, team_alert_times: [] }], error: null };
  if (name === "public_get_company_by_slug") return { data: { id: "demo-company", name: "Nuvexa", slug: args?._slug ?? "nuvexa", primary_color: "#172554", secondary_color: "#2563eb", is_active: true, is_system: true, enabled_modules: [] }, error: null };
  return { data: null, error: null };
 },
 channel: (_name: string) => { const callbacks: Array<(payload:any)=>void> = []; const channel: any = { on: (_event: string, _filter: any, cb: any) => { callbacks.push(cb); return channel; }, subscribe: () => { const fn=(e:any)=>callbacks.forEach(cb=>cb({ eventType:"UPDATE", new: read(e.detail.table), old:null })); window.addEventListener("nuvexa-local-change",fn); (channel as any)._cleanup=()=>window.removeEventListener("nuvexa-local-change",fn); return channel; }, unsubscribe: async () => { channel._cleanup?.(); return "ok"; } }; return channel; },
 removeChannel: async (channel: any) => { channel?._cleanup?.(); return "ok"; },
 storage: { from: (bucket: string) => ({ upload: async (path: string, file: File) => { try { const key=PREFIX+"files:"+bucket; const all=JSON.parse(localStorage.getItem(key)||"{}"); all[path]={ name:file.name, type:file.type, size:file.size, updated_at:new Date().toISOString() }; localStorage.setItem(key,JSON.stringify(all)); return { data:{path},error:null }; } catch { return {data:null,error:{message:"Armazenamento local indisponível"}}; } }, getPublicUrl: (path: string) => ({ data:{ publicUrl: "" } }), remove: async (paths: string[]) => { try { const key=PREFIX+"files:"+bucket; const all=JSON.parse(localStorage.getItem(key)||"{}"); paths.forEach(p=>delete all[p]); localStorage.setItem(key,JSON.stringify(all)); } catch {} return {data:[],error:null}; }, list: async () => ({data:[],error:null}) }) }
};
export { supabase };
