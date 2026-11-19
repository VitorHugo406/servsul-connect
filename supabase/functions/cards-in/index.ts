// Create cards from outside (forms, Zapier/Make/n8n, the company's own system): POST /cards-in with the mural key
// (board_inbound_keys.token, "ewv_…") in `Authorization: Bearer <key>`, `X-Ewvon-Key: <key>` or `?key=<key>`.
// Body (JSON or form-urlencoded): title (required), description, due_date (ISO, yyyy-mm-dd or dd/mm/yyyy[ hh:mm]),
// priority (urgent|high|medium|low or urgente|alta|média|baixa), assignee_email, labels (array or "a, b" — only labels
// that already exist on the mural), redirect (https URL, for plain HTML forms → 303). The card goes to the key's column
// (or the first regular column) at the end; it is created by the person who made the key, so normal triggers
// (webhooks, instant automations, numbering) run. Nothing else can be read or changed with the key.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-ewvon-key, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
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
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  const key = (req.headers.get('x-ewvon-key') || (auth.startsWith('Bearer ewv_') ? auth.slice(7) : '') || url.searchParams.get('key') || '').trim();
  if (!/^ewv_[0-9a-f]{48}$/.test(key)) return json({ ok: false, error: 'Chave inválida' }, 401);
  const len = Number(req.headers.get('content-length') || 0); if (len > 65536) return json({ ok: false, error: 'Conteúdo grande demais' }, 413);

  let body: Record<string, any> = {};
  const ct = req.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) body = await req.json();
    else { const f = await req.formData(); for (const [k, v] of f.entries()) if (typeof v === 'string') body[k] = v; }
  } catch { return json({ ok: false, error: 'Corpo inválido' }, 400); }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: k } = await db.from('board_inbound_keys').select('id, board_id, column_id, enabled, created_by, uses, last_at').eq('token', key).maybeSingle();
  if (!k || !k.enabled) return json({ ok: false, error: 'Chave inválida ou desativada' }, 401);
  // light flood guard: at most ~1 card per second per key
  if (k.last_at && Date.now() - new Date(k.last_at).getTime() < 800) return json({ ok: false, error: 'Muitas requisições, tente de novo' }, 429);
  const { data: board } = await db.from('task_boards').select('id, company_id, name').eq('id', k.board_id).maybeSingle();
  if (!board) return json({ ok: false, error: 'Mural não encontrado' }, 404);

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
