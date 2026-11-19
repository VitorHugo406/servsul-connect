// Create cards from outside (forms, Zapier/Make/n8n, the company's own system): POST /cards-in with the mural key
// (board_inbound_keys.token, "ewv_…") in `Authorization: Bearer <key>`, `X-Ewvon-Key: <key>` or `?key=<key>`.
// Body (JSON or form-urlencoded): title (required), description, due_date (ISO, yyyy-mm-dd or dd/mm/yyyy[ hh:mm]),
// priority (urgent|high|medium|low or urgente|alta|média|baixa), assignee_email, labels (array or "a, b" — only labels
// that already exist on the mural), redirect (https URL, for plain HTML forms → 303). The card goes to the key's column
// (or the first regular column) at the end; it is created by the person who made the key, so normal triggers
// (webhooks, instant automations, numbering) run. A key with scope 'create' only creates cards; a key with scope 'full'
// can also GET /cards-in (list: ?column=&q=&open=1&limit=) , GET /cards-in?id=<card> (one card with fields, links,
// checklist) and PATCH /cards-in?id=<card> (title, description, due_date, priority, assignee_email, column, done).
// Public docs: ewvon.com/desenvolvedores.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-ewvon-key, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const PRI: Record<string, string> = { urgent: 'urgent', urgente: 'urgent', high: 'high', alta: 'high', medium: 'medium', media: 'medium', 'média': 'medium', normal: 'medium', low: 'low', baixa: 'low' };

function parseDate(v: unknown): string | null | undefined {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '18').padStart(2, '0')}:${m[5] || '00'}:00-03:00`).toISOString();
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(`${s}T18:00:00-03:00`).toISOString();
  const d = new Date(s); return isNaN(d.getTime()) ? undefined : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!['POST', 'GET', 'PATCH'].includes(req.method)) return json({ ok: false, error: 'Use GET, POST ou PATCH' }, 405);
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const key = (req.headers.get('x-ewvon-key') || (auth.startsWith('Bearer ewv_') ? auth.slice(7) : '') || url.searchParams.get('key') || '').trim();
  if (!/^ewv_[0-9a-f]{48}$/.test(key)) return json({ ok: false, error: 'Chave inválida' }, 401);
  const len = Number(req.headers.get('content-length') || 0); if (len > 65536) return json({ ok: false, error: 'Conteúdo grande demais' }, 413);

  let body: Record<string, any> = {};
  const ct = req.headers.get('content-type') || '';
  if (req.method !== 'GET') {
    try {
      if (ct.includes('application/json')) body = await req.json();
      else { const f = await req.formData(); for (const [k, v] of f.entries()) if (typeof v === 'string') body[k] = v; }
    } catch { return json({ ok: false, error: 'Corpo inválido' }, 400); }
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: k } = await db.from('board_inbound_keys').select('id, board_id, column_id, enabled, created_by, uses, last_at, scope').eq('token', key).maybeSingle();
  if (!k || !k.enabled) return json({ ok: false, error: 'Chave inválida ou desativada' }, 401);
  const { data: board } = await db.from('task_boards').select('id, company_id, name').eq('id', k.board_id).maybeSingle();
  if (!board) return json({ ok: false, error: 'Mural não encontrado' }, 404);
  if (req.method !== 'POST') {
    if (k.scope !== 'full') return json({ ok: false, error: 'Esta chave só cria cards. Ative "API completa" na chave do mural.' }, 403);
    return req.method === 'GET' ? await readCards(db, board, url) : await patchCard(db, board, k, url, body);
  }
  // light flood guard: at most ~1 card per second per key
  if (k.last_at && Date.now() - new Date(k.last_at).getTime() < 800) return json({ ok: false, error: 'Muitas requisições, tente de novo' }, 429);

  const title = String(body.title ?? body.titulo ?? body.name ?? body.nome ?? '').trim().slice(0, 300);
  if (!title) return json({ ok: false, error: 'Informe o título (title)' }, 400);
  const description = String(body.description ?? body.descricao ?? body['descrição'] ?? '').slice(0, 10000);
  const due = parseDate(body.due_date ?? body.prazo);
  if (due === undefined) return json({ ok: false, error: 'Prazo (due_date) inválido' }, 400);
  const priority = PRI[String(body.priority ?? body.prioridade ?? 'medium').toLowerCase().trim()] || 'medium';

  const { data: cols } = await db.from('task_board_columns').select('id, title, position, is_template_column, is_conclusion').eq('board_id', board.id).order('position');
  const col = (cols || []).find((c: any) => c.id === k.column_id) || (cols || []).find((c: any) => !c.is_template_column && !c.is_conclusion) || (cols || [])[0];
  if (!col) return json({ ok: false, error: 'O mural não tem colunas' }, 400);

  let assignee: string | null = null;
  const email = String(body.assignee_email ?? body.responsavel_email ?? '').trim().toLowerCase();
  if (email) { const { data: p } = await db.from('profiles').select('id').eq('company_id', board.company_id).eq('is_active', true).ilike('email', email).maybeSingle(); assignee = p?.id ?? null; }

  const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('board_id', board.id).eq('status', col.id);
  const { data: task, error } = await db.from('tasks').insert({
    title, description: description ? description.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;')).replace(/\n/g, '<br>') : null,
    status: col.id, priority, due_date: due, assigned_to: assignee, board_id: board.id, company_id: board.company_id,
    created_by: k.created_by, position: count ?? 0,
  }).select('id, task_number').single();
  if (error || !task) return json({ ok: false, error: 'Não foi possível criar o card' }, 500);

  const raw = body.labels ?? body.etiquetas;
  const names = (Array.isArray(raw) ? raw : String(raw ?? '').split(',')).map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 10);
  if (names.length) {
    const { data: labs } = await db.from('task_labels').select('id, name').eq('board_id', board.id);
    const rows = (labs || []).filter((l: any) => names.includes(String(l.name).toLowerCase())).map((l: any) => ({ task_id: task.id, label_id: l.id }));
    if (rows.length) await db.from('task_label_assignments').insert(rows);
  }
  await db.from('board_inbound_keys').update({ uses: (k.uses || 0) + 1, last_at: new Date().toISOString() }).eq('id', k.id);
  if (k.created_by) await db.from('task_activities').insert({ task_id: task.id, user_id: k.created_by, user_name: 'Integração', action_type: 'create', description: 'criou o card pela integração (API do mural)' }).then(() => {}, () => {});

  const link = `https://ewvon.com/tarefas?board=${board.id}&task=${task.id}`;
  const redirect = String(body.redirect ?? '');
  if (!ct.includes('application/json') && /^https:\/\/[^\s]+$/.test(redirect)) return new Response(null, { status: 303, headers: { ...cors, Location: redirect } });
  return json({ ok: true, id: task.id, number: task.task_number, column: col.title, board: board.name, url: link }, 201);
});

const SEL = 'id, task_number, title, description, status, priority, due_date, start_date, completed_at, assigned_to, created_at, updated_at';
async function cardOut(db: any, board: any, rows: any[], full: boolean) {
  const { data: cols } = await db.from('task_board_columns').select('id, title, is_conclusion').eq('board_id', board.id);
  const colBy = new Map((cols || []).map((c: any) => [c.id, c]));
  const ppl = [...new Set(rows.map((t) => t.assigned_to).filter(Boolean))];
  const { data: ps } = ppl.length ? await db.from('profiles').select('id, name, display_name, email').in('id', ppl) : { data: [] };
  const pBy = new Map((ps || []).map((p: any) => [p.id, p]));
  const ids = rows.map((t) => t.id);
  const [{ data: la }, fv, links, subs] = await Promise.all([
    ids.length ? db.from('task_label_assignments').select('task_id, task_labels(name)').in('task_id', ids) : { data: [] },
    full && ids.length ? db.from('task_field_values').select('task_id, value, board_custom_fields(name)').in('task_id', ids) : { data: [] },
    full && ids.length ? db.from('task_links').select('task_id, url, title').in('task_id', ids) : { data: [] },
    full && ids.length ? db.from('task_subtasks').select('task_id, title, is_completed').in('task_id', ids).order('position') : { data: [] },
  ]);
  return rows.map((t) => {
    const c: any = colBy.get(t.status); const p: any = pBy.get(t.assigned_to);
    const o: Record<string, unknown> = {
      id: t.id, number: t.task_number, title: t.title, column: c ? { id: c.id, title: c.title } : null, priority: t.priority,
      due_date: t.due_date, start_date: t.start_date, done: !!t.completed_at || !!c?.is_conclusion, completed_at: t.completed_at,
      assignee: p ? { name: p.display_name || p.name, email: p.email } : null,
      labels: (la || []).filter((x: any) => x.task_id === t.id).map((x: any) => x.task_labels?.name).filter(Boolean),
      created_at: t.created_at, updated_at: t.updated_at, url: `https://ewvon.com/tarefas?board=${board.id}&task=${t.id}`,
    };
    if (full) {
      o.description = (t.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
      o.fields = Object.fromEntries(((fv as any).data || []).filter((x: any) => x.task_id === t.id).map((x: any) => [x.board_custom_fields?.name, x.value]));
      o.links = ((links as any).data || []).filter((x: any) => x.task_id === t.id).map((x: any) => ({ url: x.url, title: x.title }));
      o.checklist = ((subs as any).data || []).filter((x: any) => x.task_id === t.id).map((x: any) => ({ title: x.title, done: x.is_completed }));
    }
    return o;
  });
}

async function readCards(db: any, board: any, url: URL) {
  const id = url.searchParams.get('id');
  if (id) {
    const { data: t } = await db.from('tasks').select(SEL).eq('id', id).eq('board_id', board.id).eq('is_template', false).maybeSingle();
    if (!t) return json({ ok: false, error: 'Card não encontrado' }, 404);
    return json({ ok: true, card: (await cardOut(db, board, [t], true))[0] });
  }
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)));
  let q = db.from('tasks').select(SEL).eq('board_id', board.id).eq('is_template', false).eq('is_archived', false).order('task_number', { ascending: false }).limit(limit);
  const col = url.searchParams.get('column'); if (col) q = q.eq('status', col);
  if (url.searchParams.get('open') === '1') q = q.is('completed_at', null);
  const term = (url.searchParams.get('q') || '').trim().slice(0, 80); if (term) q = q.ilike('title', `%${term.replace(/[%_]/g, '')}%`);
  const { data, error } = await q; if (error) return json({ ok: false, error: 'Não foi possível listar' }, 500);
  const { data: cols } = await db.from('task_board_columns').select('id, title, position, is_conclusion').eq('board_id', board.id).order('position');
  return json({ ok: true, board: { id: board.id, name: board.name }, columns: (cols || []).map((c: any) => ({ id: c.id, title: c.title, done: !!c.is_conclusion })), cards: await cardOut(db, board, data || [], false) });
}

async function patchCard(db: any, board: any, k: any, url: URL, body: Record<string, any>) {
  const id = url.searchParams.get('id') || body.id;
  const { data: t } = await db.from('tasks').select('id, status, due_date, completed_at, company_id').eq('id', id).eq('board_id', board.id).eq('is_template', false).maybeSingle();
  if (!t) return json({ ok: false, error: 'Card não encontrado' }, 404);
  const { data: lock } = await db.from('war_rooms').select('id').eq('task_id', t.id).eq('status', 'active').limit(1);
  if ((lock || []).length) return json({ ok: false, error: 'Card controlado por uma War Room ativa' }, 409);
  const u: Record<string, unknown> = {};
  if (body.title !== undefined) { const v = String(body.title).trim().slice(0, 300); if (!v) return json({ ok: false, error: 'Título vazio' }, 400); u.title = v; }
  if (body.description !== undefined) u.description = String(body.description || '').slice(0, 10000).replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;')).replace(/\n/g, '<br>') || null;
  if (body.due_date !== undefined) { const d = parseDate(body.due_date); if (d === undefined) return json({ ok: false, error: 'Prazo inválido' }, 400); u.due_date = d; }
  if (body.priority !== undefined) { const p = PRI[String(body.priority).toLowerCase().trim()]; if (!p) return json({ ok: false, error: 'Prioridade inválida' }, 400); u.priority = p; }
  if (body.assignee_email !== undefined) {
    if (!body.assignee_email) u.assigned_to = null;
    else { const { data: p } = await db.from('profiles').select('id').eq('company_id', board.company_id).eq('is_active', true).ilike('email', String(body.assignee_email).trim()).maybeSingle(); if (!p) return json({ ok: false, error: 'Responsável não encontrado na empresa' }, 400); u.assigned_to = p.id; }
  }
  const { data: cols } = await db.from('task_board_columns').select('id, title, position, is_conclusion').eq('board_id', board.id).order('position');
  let target: any = null;
  if (body.column !== undefined) { const c = String(body.column).trim().toLowerCase(); target = (cols || []).find((x: any) => x.id === body.column || String(x.title).toLowerCase() === c); if (!target) return json({ ok: false, error: 'Coluna não encontrada' }, 400); }
  if (body.done === true || body.done === 'true') target = target || (cols || []).find((x: any) => x.is_conclusion);
  if (target && target.id !== t.status) {
    u.status = target.id; u.position = 0;
    if (target.is_conclusion && !t.completed_at) { const due = (u.due_date as string) || t.due_date; u.completed_at = new Date().toISOString(); u.completed_late = !!due && Date.now() > new Date(due).getTime(); }
    if (!target.is_conclusion && t.completed_at) { u.completed_at = null; u.completed_late = null; }
  }
  if (!Object.keys(u).length) return json({ ok: false, error: 'Nada para alterar' }, 400);
  const { error } = await db.from('tasks').update(u).eq('id', t.id);
  if (error) return json({ ok: false, error: /CARD_BLOCKED:(.*)/.exec(error.message || '')?.[1]?.trim() || 'Não foi possível alterar o card' }, 409);
  if (k.created_by) await db.from('task_activities').insert({ task_id: t.id, user_id: k.created_by, user_name: 'Integração', action_type: target ? 'move' : 'update', description: target ? `moveu pela integração para "${target.title}"` : 'alterou o card pela integração (API do mural)' }).then(() => {}, () => {});
  const { data: fresh } = await db.from('tasks').select(SEL).eq('id', t.id).single();
  return json({ ok: true, card: (await cardOut(db, board, [fresh], true))[0] });
}
