// EwvonAI: each company uses its own Claude API key.
//   POST /ewvon-ai/save    company admin: { key?, model?, enabled?, daily_limit? }  (the key is validated and encrypted)
//   POST /ewvon-ai/remove  company admin
//   POST /ewvon-ai/ask     database trigger (Vault secret header): { table, id } -> a sector, group or direct message that mentions @ewvonai
// The answer is posted in the same chat by the "EwvonAI" sender. The model can create cards with the author's own
// access: only boards the author owns or belongs to.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const AI_SENDER = '00000000-0000-0000-0000-0000000000c2';
const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';

// ---- same encryption as the `integrations` function (key derived from the service role key)
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function claude(apiKey: string, body: Record<string, unknown>) {
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status}: ${String(j?.error?.message || 'erro').slice(0, 200)}`);
  return j as { content: any[]; stop_reason: string };
}

const TOOLS = [
  {
    name: 'create_task',
    description: 'Cria um card (tarefa) em um mural de tarefas do ewvon. Use quando a pessoa pedir para criar tarefa/card/lembrete/pendência. Pode ser chamada várias vezes para vários cards.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto e claro do card (máx. 200 caracteres).' },
        description: { type: 'string', description: 'Descrição com o contexto e o que precisa ser feito.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'low=baixa, medium=média, high=alta, urgent=urgente.' },
        due_date: { type: 'string', description: 'Prazo no formato AAAA-MM-DD (use a data de hoje informada para calcular "amanhã", "sexta" etc.).' },
        board: { type: 'string', description: 'Nome do mural. Se houver só um mural disponível, pode omitir.' },
        column: { type: 'string', description: 'Nome da coluna do mural (ex.: A fazer). Se omitir, usa a primeira.' },
        assignee: { type: 'string', description: 'Nome da pessoa responsável, exatamente como na lista de pessoas. Omita se ninguém foi indicado.' },
        subtasks: { type: 'array', items: { type: 'string' }, description: 'Lista de subtarefas (checklist), se fizer sentido.' },
      },
      required: ['title'],
    },
  },
];

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const findByName = <T extends { name?: string; title?: string }>(list: T[], q?: string) => {
  if (!q) return null; const n = norm(q);
  return list.find((x) => norm(x.name ?? x.title ?? '') === n) || list.find((x) => norm(x.name ?? x.title ?? '').includes(n) || n.includes(norm(x.name ?? x.title ?? ''))) || null;
};

async function handleAsk(table: string, id: string) {
  // 1. The message and where it was written
  let msg: any, cid: string | null, authorId: string, convFilter: (q: any) => any, insertReply: (text: string) => Promise<void>, ctxTable: string, convLabel = '';
  if (table === 'messages') {
    const { data } = await admin.from('messages').select('id, content, author_id, sector_id, company_id, created_at').eq('id', id).maybeSingle();
    if (!data) return; msg = data; cid = data.company_id; authorId = data.author_id; ctxTable = 'messages';
    convFilter = (q) => q.eq('sector_id', data.sector_id);
    insertReply = async (text) => { await admin.from('messages').insert({ content: text, author_id: AI_SENDER, sector_id: data.sector_id, company_id: data.company_id, reply_to_id: data.id }); };
    const { data: s } = await admin.from('sectors').select('name').eq('id', data.sector_id).maybeSingle(); convLabel = `setor ${s?.name ?? ''}`;
  } else if (table === 'private_group_messages') {
    const { data } = await admin.from('private_group_messages').select('id, content, sender_id, group_id, created_at').eq('id', id).maybeSingle();
    if (!data) return; msg = data; authorId = data.sender_id; ctxTable = 'private_group_messages';
    const { data: g } = await admin.from('private_groups').select('company_id, name').eq('id', data.group_id).maybeSingle();
    cid = g?.company_id ?? null; convLabel = `grupo ${g?.name ?? ''}`;
    convFilter = (q) => q.eq('group_id', data.group_id);
    insertReply = async (text) => { await admin.from('private_group_messages').insert({ content: text, sender_id: AI_SENDER, group_id: data.group_id, reply_to_id: data.id }); };
  } else if (table === 'direct_messages') {
    const { data } = await admin.from('direct_messages').select('id, content, sender_id, receiver_id, company_id, created_at').eq('id', id).maybeSingle();
    if (!data) return; msg = data; cid = data.company_id; authorId = data.sender_id; ctxTable = 'direct_messages';
    const a = data.sender_id, b = data.receiver_id;
    const { data: other } = await admin.from('profiles').select('name, display_name').eq('id', b).maybeSingle();
    convLabel = a === b ? 'conversa da pessoa consigo mesma' : `conversa direta com ${other?.display_name || other?.name || 'outra pessoa'}`;
    convFilter = (q) => q.or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`);
    // one reply row per person of the chat, each inside the same conversation (ai_partner_id = the other person)
    insertReply = async (text) => {
      const rows: Record<string, unknown>[] = [{ content: text, sender_id: AI_SENDER, receiver_id: a, ai_partner_id: b, company_id: cid, reply_to_id: data.id, is_read: true }];
      if (b !== a) rows.push({ content: text, sender_id: AI_SENDER, receiver_id: b, ai_partner_id: a, company_id: cid, reply_to_id: data.id, is_read: false });
      await admin.from('direct_messages').insert(rows);
    };
  } else return;
  if (!cid) return;

  // 2. Company settings, author, daily limit
  const { data: integ } = await admin.from('company_integrations').select('secret_enc, enabled, config').eq('company_id', cid).eq('provider', 'claude').maybeSingle();
  if (!integ?.enabled || !integ.secret_enc) {
    // No Claude key registered: tell the person (instead of staying silent) and nudge the company to connect one.
    await insertReply('*EwvonAI ainda não está ativo nesta empresa.*\n\nA empresa não possui chaves de acesso à API de inteligência artificial cadastradas. Entre em contato com o administrador do sistema para cadastrar a API da Claude em Integrações > EwvonAI. Com ela, o EwvonAI responde perguntas e cria tarefas direto do chat, e mais funcionalidades de IA ficam liberadas para a equipe.');
    return;
  }
  const { data: me } = await admin.from('profiles').select('id, user_id, name, display_name, company_id, is_active').eq('id', authorId).maybeSingle();
  if (!me || me.company_id !== cid || !me.is_active) return;
  const limit = Math.min(Math.max(Number(integ.config?.daily_limit) || 30, 1), 500);
  const { data: allowed } = await admin.rpc('ai_use', { _profile: me.id, _company: cid, _limit: limit });
  if (allowed !== true) { await insertReply(`Você chegou ao limite de ${limit} pedidos por dia para o EwvonAI. Volte amanhã ou peça ao administrador para aumentar o limite.`); return; }

  const question = String(msg.content || '').replace(/@ewvon\s?ai/gi, '').replace(/\s+/g, ' ').trim();
  if (!question) { await insertReply('Oi! Pode me perguntar qualquer coisa ou pedir para criar tarefas. Exemplo: "@EwvonAI crie uma tarefa para revisar o contrato até sexta, prioridade alta".'); return; }

  // 3. Context: last messages of this conversation, boards the author can use, people of the company
  const { data: recent } = await convFilter(admin.from(ctxTable).select(ctxTable === 'messages' ? 'content, author_id, created_at' : 'content, sender_id, created_at')).lt('created_at', msg.created_at).order('created_at', { ascending: false }).limit(12);
  const authorIds = [...new Set((recent || []).map((m: any) => m.author_id || m.sender_id))];
  const { data: names } = authorIds.length ? await admin.from('profiles').select('id, name, display_name').in('id', authorIds) : { data: [] } as any;
  const nameOf = new Map<string, string>((names || []).map((p: any) => [p.id, p.display_name || p.name]));
  nameOf.set(AI_SENDER, 'EwvonAI');
  const history = (recent || []).reverse().map((m: any) => `${nameOf.get(m.author_id || m.sender_id) || 'Alguém'}: ${String(m.content).replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');

  const [{ data: owned }, { data: member }] = await Promise.all([
    admin.from('task_boards').select('id, name').eq('company_id', cid).eq('owner_id', me.user_id),
    admin.from('task_board_members').select('board_id').eq('user_id', me.user_id),
  ]);
  const memberIds = (member || []).map((m: any) => m.board_id);
  const { data: memberBoards } = memberIds.length ? await admin.from('task_boards').select('id, name').eq('company_id', cid).in('id', memberIds) : { data: [] } as any;
  const boards: { id: string; name: string }[] = [...new Map([...(owned || []), ...(memberBoards || [])].map((b: any) => [b.id, b])).values()].slice(0, 25);
  const columnsByBoard = new Map<string, any[]>();
  if (boards.length) {
    const { data: cols } = await admin.from('task_board_columns').select('id, title, board_id, position, auto_assign_to, auto_cover, is_template_column').in('board_id', boards.map((b) => b.id)).order('position');
    for (const c of cols || []) { if (c.is_template_column) continue; (columnsByBoard.get(c.board_id) ?? columnsByBoard.set(c.board_id, []).get(c.board_id)!).push(c); }
  }
  const { data: people } = await admin.from('profiles').select('id, name, display_name').eq('company_id', cid).eq('is_active', true).neq('profile_type', 'system').limit(300);
  const peopleList = (people || []).map((p: any) => ({ id: p.id, name: p.display_name || p.name }));

  const today = new Date(); const todayBR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);
  const isoBR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(today);
  const system = [
    'Você é o EwvonAI, o assistente de IA da plataforma ewvon (gestão e comunicação corporativa), respondendo dentro de um chat da empresa.',
    'Responda em português do Brasil, de forma curta, clara e útil (no máximo ~8 linhas, sem enrolação). Pode usar *negrito* e listas simples. Não use títulos markdown (#) nem tabelas.',
    'Você pode responder dúvidas gerais (inclusive fora do sistema), ajudar a redigir textos e criar cards de tarefas com a ferramenta create_task.',
    'Ao criar cards: use um título objetivo, escreva uma descrição útil, defina prioridade e prazo quando a pessoa indicar ou quando for razoável deduzir, e crie subtarefas se o pedido tiver etapas. Só atribua responsável se a pessoa pediu e o nome estiver na lista de pessoas.',
    'Depois de criar, confirme com um resumo curto (título, prazo, prioridade, responsável e mural). Nunca diga que criou algo se a ferramenta devolveu erro: explique o erro e diga o que falta.',
    'Se pedirem algo que você não pode fazer no ewvon (apagar dados, mudar permissões, ver conversas privadas), explique com gentileza que não consegue.',
    `Hoje é ${todayBR} (${isoBR}), fuso de São Paulo. Quem está pedindo: ${me.display_name || me.name}. Conversa: ${convLabel}.`,
    boards.length ? `Murais que esta pessoa pode usar: ${boards.map((b) => `"${b.name}" (colunas: ${(columnsByBoard.get(b.id) || []).map((c) => c.title).join(', ') || 'nenhuma'})`).join('; ')}.` : 'Esta pessoa ainda não tem acesso a nenhum mural de tarefas: não é possível criar cards; diga isso se pedirem.',
    `Pessoas da empresa (para responsável): ${peopleList.map((p) => p.name).join(', ')}.`,
  ].join('\n');

  const userText = (history ? `Conversa recente:\n${history}\n\n` : '') + `Pedido de ${me.display_name || me.name}: ${question}`;
  const apiKey = await open(integ.secret_enc);
  const model = MODELS.includes(integ.config?.model) ? integ.config.model : DEFAULT_MODEL;
  const messages: any[] = [{ role: 'user', content: userText }];
  const created: string[] = [];
  let finalText = '';

  try {
    for (let round = 0; round < 5; round++) {
      const res = await claude(apiKey, { model, max_tokens: 1024, system, messages, tools: boards.length ? TOOLS : undefined });
      const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      const uses = res.content.filter((b: any) => b.type === 'tool_use');
      if (!uses.length) { finalText = text; break; }
      messages.push({ role: 'assistant', content: res.content });
      const results: any[] = [];
      for (const u of uses) {
        let out: string;
        try { out = await createTask(u.input || {}, { me, cid, boards, columnsByBoard, peopleList }); created.push(out); }
        catch (e) { out = `ERRO: ${(e as Error).message}`; }
        results.push({ type: 'tool_result', tool_use_id: u.id, content: out, is_error: out.startsWith('ERRO') });
      }
      messages.push({ role: 'user', content: results });
      if (round === 4) finalText = text || (created.length ? `Pronto! Criei ${created.length} card(s).` : '');
    }
    await admin.from('company_integrations').update({ last_status: 'ok', last_error: null, last_used_at: new Date().toISOString() }).eq('company_id', cid).eq('provider', 'claude');
  } catch (e) {
    const detail = (e as Error).message;
    await admin.from('company_integrations').update({ last_status: 'erro', last_error: detail.slice(0, 300) }).eq('company_id', cid).eq('provider', 'claude');
    const hint = /^401/.test(detail) ? 'A chave de IA da empresa foi recusada. O administrador precisa conferir a chave em Integrações.' : /^429/.test(detail) ? 'O limite da conta de IA da empresa foi atingido. Tente de novo em instantes.' : 'Não consegui responder agora. Tente novamente em instantes.';
    await insertReply(hint); return;
  }
  await insertReply((finalText || 'Pronto!').slice(0, 3500));
}

async function createTask(input: any, ctx: { me: any; cid: string; boards: { id: string; name: string }[]; columnsByBoard: Map<string, any[]>; peopleList: { id: string; name: string }[] }): Promise<string> {
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) throw new Error('título vazio');
  const board = ctx.boards.length === 1 ? ctx.boards[0] : findByName(ctx.boards, input.board);
  if (!board) throw new Error(`mural não encontrado. Murais disponíveis: ${ctx.boards.map((b) => b.name).join(', ')}`);
  const cols = ctx.columnsByBoard.get(board.id) || [];
  if (!cols.length) throw new Error(`o mural "${board.name}" não tem colunas`);
  const col = findByName(cols, input.column) || cols[0];
  let assigned: string | null = null;
  if (input.assignee) { const p = findByName(ctx.peopleList, input.assignee); if (!p) throw new Error(`pessoa "${input.assignee}" não encontrada`); assigned = p.id; }
  assigned = assigned || col.auto_assign_to || null;
  const priority = ['low', 'medium', 'high', 'urgent'].includes(input.priority) ? input.priority : 'medium';
  let due: string | null = null;
  if (typeof input.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) due = `${input.due_date}T21:00:00Z`;   // end of the day in São Paulo
  const { count } = await admin.from('tasks').select('id', { count: 'exact', head: true }).eq('board_id', board.id).eq('status', col.id).eq('is_archived', false);
  const row: Record<string, unknown> = { title, description: String(input.description || '').trim().slice(0, 4000) || null, status: col.id, board_id: board.id, created_by: ctx.me.id, priority, position: count || 0, assigned_to: assigned, due_date: due, company_id: ctx.cid };
  if (col.auto_cover) row.cover_image = col.auto_cover;
  const { data: t, error } = await admin.from('tasks').insert(row).select('id, task_number').single();
  if (error || !t) throw new Error(error?.message || 'falha ao criar');
  const subs = (Array.isArray(input.subtasks) ? input.subtasks : []).map((s: unknown) => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 15);
  if (subs.length) await admin.from('task_subtasks').insert(subs.map((s: string, i: number) => ({ task_id: t.id, title: s, position: i })));
  await admin.rpc('log_task_activity_secure', { _task_id: t.id, _action_type: 'created', _description: 'Card criado pelo EwvonAI', _metadata: { source: 'ewvon-ai', requested_by: ctx.me.id } }).then(() => undefined, () => undefined);
  const who = assigned ? ctx.peopleList.find((p) => p.id === assigned)?.name : null;
  return `Card #${t.task_number ?? ''} criado: "${title}" no mural "${board.name}", coluna "${col.title}", prioridade ${priority}${due ? `, prazo ${input.due_date}` : ''}${who ? `, responsável ${who}` : ''}${subs.length ? `, ${subs.length} subtarefa(s)` : ''}.`;
}

// ───────────── user features (any member of a company with the AI turned on)
//   POST /ewvon-ai/summarize_chat   { kind: 'sector'|'group'|'dm', id, hours? }  -> { text, count }
//   POST /ewvon-ai/summarize_board  { board_id }                                  -> { text }
//   POST /ewvon-ai/cards_from_text  { board_id, text }                            -> { cards: [...] } (proposals; the app creates them)
// Data is read with the person's own token, so row-level security decides what the AI can see.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
async function claudeUser(apiKey: string, model: string, body: Record<string, unknown>) {
  const withFallback = model !== 'claude-haiku-5-5';   // refusal fallback routing is not offered for Haiku
  const call = async (fb: boolean) => {
    const h: Record<string, string> = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    if (fb) h['anthropic-beta'] = FALLBACK_BETA;
    const r = await fetch(API, { method: 'POST', headers: h, body: JSON.stringify(fb ? { ...body, model, fallbacks: 'default' } : { ...body, model }) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  };
  let res = await call(withFallback);
  if (!res.ok && withFallback && res.status === 400 && /fallback|beta/i.test(String(res.j?.error?.message || ''))) res = await call(false);
  if (!res.ok) throw new Error(`${res.status}: ${String(res.j?.error?.message || 'erro').slice(0, 200)}`);
  return res.j as { content: any[]; stop_reason: string };
}
const textOf = (res: { content: any[] }) => res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
const aiHint = (detail: string) => /^401/.test(detail) ? 'A chave de IA da empresa foi recusada. O administrador precisa conferir a chave em Integrações.'
  : /^429/.test(detail) ? 'O limite da conta de IA da empresa foi atingido. Tente de novo em instantes.' : 'Não foi possível usar a IA agora. Tente novamente em instantes.';

class UserError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

async function userCtx(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
  if (!u?.user) throw new UserError('Entre novamente para usar a IA.', 401);
  const { data: me } = await admin.from('profiles').select('id, user_id, name, display_name, company_id, is_active').eq('user_id', u.user.id).eq('is_active', true).limit(1).maybeSingle();
  if (!me?.company_id) throw new UserError('Perfil não encontrado.', 403);
  const { data: integ } = await admin.from('company_integrations').select('secret_enc, enabled, config').eq('company_id', me.company_id).eq('provider', 'claude').maybeSingle();
  if (!integ?.enabled || !integ.secret_enc) throw new UserError('A IA ainda não está ativa nesta empresa. Peça ao administrador para cadastrar a chave da Claude em Integrações > EwvonAI.', 412);
  const limit = Math.min(Math.max(Number(integ.config?.daily_limit) || 30, 1), 500);
  const { data: allowed } = await admin.rpc('ai_use', { _profile: me.id, _company: me.company_id, _limit: limit });
  if (allowed !== true) throw new UserError(`Você chegou ao limite de ${limit} pedidos de IA por dia. Volte amanhã ou peça ao administrador para aumentar o limite.`, 429);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const model = MODELS.includes(integ.config?.model) ? integ.config.model : DEFAULT_MODEL;
  return { me, db, apiKey: await open(integ.secret_enc), model, cid: me.company_id as string };
}
const markUse = (cid: string, err?: string) => admin.from('company_integrations').update(err ? { last_status: 'erro', last_error: err.slice(0, 300) } : { last_status: 'ok', last_error: null, last_used_at: new Date().toISOString() }).eq('company_id', cid).eq('provider', 'claude');
const brNow = () => {
  const d = new Date();
  return { long: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d), iso: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d) };
};
const hhmm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** Chat payloads (stickers, calls, voice, files, polls) become short readable markers. */
function plainMessage(c: string): string {
  const s = String(c || '');
  if (/^(📹|📞) ewvon-call:/.test(s)) return '[chamada]';
  if (/^ewvon-poll:/.test(s)) return '[enquete]';
  if (/ewvon-delete:/.test(s)) return '[aviso do sistema]';
  if (/^🎤 \[/.test(s)) return '[áudio]';
  if (/^✨ (sticker|pack):/.test(s)) return '[figurinha]';
  return s.split('\n').map((l) => { const m = l.match(/^(📷|📎) \[(.+?)\]\(.+?\)$/); return m ? `[arquivo: ${m[2]}]` : l; }).join(' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}

async function summarizeChat(req: Request, body: any) {
  const ctx = await userCtx(req);
  const kind = String(body.kind || ''); const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/.test(id) || !['sector', 'group', 'dm'].includes(kind)) throw new UserError('Conversa inválida.');
  const hours = Math.min(Math.max(Math.round(Number(body.hours) || 24), 1), 24 * 14);
  const since = new Date(Date.now() - hours * 36e5).toISOString();
  let rows: any[] = []; let label = '';
  if (kind === 'sector') {
    const { data, error } = await ctx.db.from('messages').select('content, author_id, created_at').eq('sector_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(400);
    if (error) throw new UserError('Você não tem acesso a esta conversa.', 403);
    rows = (data || []).map((m: any) => ({ ...m, who: m.author_id }));
    const { data: s } = await ctx.db.from('sectors').select('name').eq('id', id).maybeSingle(); label = `setor ${s?.name ?? ''}`;
  } else if (kind === 'group') {
    const { data, error } = await ctx.db.from('private_group_messages').select('content, sender_id, created_at').eq('group_id', id).gte('created_at', since).order('created_at', { ascending: false }).limit(400);
    if (error) throw new UserError('Você não tem acesso a esta conversa.', 403);
    rows = (data || []).map((m: any) => ({ ...m, who: m.sender_id }));
    const { data: g } = await ctx.db.from('private_groups').select('name').eq('id', id).maybeSingle(); label = `grupo ${g?.name ?? ''}`;
  } else {
    const a = ctx.me.id, b = id;
    const { data, error } = await ctx.db.from('direct_messages').select('content, sender_id, receiver_id, created_at')
      .or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`).gte('created_at', since).order('created_at', { ascending: false }).limit(400);
    if (error) throw new UserError('Você não tem acesso a esta conversa.', 403);
    rows = (data || []).map((m: any) => ({ ...m, who: m.sender_id }));
    label = 'conversa direta';
  }
  rows = rows.reverse().filter((m) => m.content && m.who !== AI_SENDER);
  if (rows.length < 2) return { text: '', count: rows.length };
  const ids = [...new Set(rows.map((m) => m.who))];
  const { data: names } = await admin.from('profiles').select('id, name, display_name').in('id', ids);
  const nameOf = new Map<string, string>((names || []).map((p: any) => [p.id, p.display_name || p.name]));
  const transcript = rows.map((m) => `${hhmm(m.created_at)} ${nameOf.get(m.who) || 'Alguém'}: ${plainMessage(m.content)}`).join('\n').slice(-60000);
  const now = brNow();
  const system = [
    'Você resume conversas de trabalho de uma empresa, dentro da plataforma ewvon. Escreva em português do Brasil.',
    'Formato (texto simples, sem títulos markdown nem tabelas; pode usar *negrito* e listas com "- "):',
    '*Resumo* — 2 a 5 linhas com os assuntos principais.',
    '*Decisões* — o que foi decidido (omita a seção se não houver).',
    '*Pendências* — o que ficou para fazer, com o nome de quem ficou responsável e prazo, quando aparecerem (omita se não houver).',
    'Seja fiel à conversa: não invente fatos, nomes, números ou prazos. Não repita mensagens inteiras.',
    `Hoje é ${now.long}. Conversa: ${label}. Período: últimas ${hours} horas.`,
  ].join('\n');
  try {
    const res = await claudeUser(ctx.apiKey, ctx.model, { max_tokens: 6000, output_config: { effort: 'low' }, system, messages: [{ role: 'user', content: `Mensagens (mais antigas primeiro):\n${transcript}` }] });
    if (res.stop_reason === 'refusal') return { text: 'A IA não pôde resumir este trecho da conversa.', count: rows.length };
    await markUse(ctx.cid);
    return { text: textOf(res).slice(0, 6000), count: rows.length };
  } catch (e) { const d = (e as Error).message; await markUse(ctx.cid, d); throw new UserError(aiHint(d), 502); }
}

async function boardContext(ctx: Awaited<ReturnType<typeof userCtx>>, boardId: string) {
  if (!/^[0-9a-f-]{36}$/.test(boardId)) throw new UserError('Mural inválido.');
  const { data: board } = await ctx.db.from('task_boards').select('id, name').eq('id', boardId).maybeSingle();
  if (!board) throw new UserError('Você não tem acesso a este mural.', 403);
  const { data: cols } = await ctx.db.from('task_board_columns').select('id, title, position, is_conclusion, is_template_column').eq('board_id', boardId).order('position');
  const columns = (cols || []).filter((c: any) => !c.is_template_column);
  return { board, columns };
}

async function summarizeBoard(req: Request, body: any) {
  const ctx = await userCtx(req);
  const { board, columns } = await boardContext(ctx, String(body.board_id || ''));
  const { data: tasks } = await ctx.db.from('tasks').select('task_number, title, status, priority, due_date, completed_at, assigned_to, updated_at')
    .eq('board_id', board.id).eq('is_template', false).eq('is_archived', false).order('updated_at', { ascending: false }).limit(500);
  const list = tasks || [];
  if (!list.length) return { text: 'Este mural ainda não tem cards para resumir.' };
  const ids = [...new Set(list.map((t: any) => t.assigned_to).filter(Boolean))];
  const { data: names } = ids.length ? await admin.from('profiles').select('id, name, display_name').in('id', ids) : { data: [] } as any;
  const nameOf = new Map<string, string>((names || []).map((p: any) => [p.id, p.display_name || p.name]));
  const colOf = new Map<string, any>(columns.map((c: any) => [c.id, c]));
  const now = brNow(); const today = now.iso;
  const lines = list.map((t: any) => {
    const c = colOf.get(t.status); const done = !!t.completed_at || !!c?.is_conclusion;
    const due = t.due_date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t.due_date)) : '';
    const late = !done && due && due < today;
    return `#${t.task_number ?? '?'} | ${String(t.title).slice(0, 140)} | coluna: ${c?.title ?? '?'}${done ? ' (concluído)' : ''} | prioridade: ${t.priority || 'medium'} | prazo: ${due || 'sem prazo'}${late ? ' (ATRASADO)' : ''} | responsável: ${t.assigned_to ? nameOf.get(t.assigned_to) || '?' : 'ninguém'}`;
  }).join('\n');
  const system = [
    'Você analisa murais de tarefas (kanban) de uma empresa na plataforma ewvon. Escreva em português do Brasil, em texto simples (sem títulos markdown nem tabelas; pode usar *negrito* e listas com "- ").',
    'Formato: *Situação geral* (2 a 4 linhas com números: total, concluídos, em andamento, atrasados); *Atenção* (cards atrasados ou em risco, com número e responsável); *Próximos prazos* (próximos 7 dias); *Sugestões* (2 a 4 ações práticas, como redistribuir carga ou definir prazos).',
    'Use somente os dados fornecidos; não invente cards, pessoas ou datas. Seja objetivo (no máximo ~20 linhas).',
    `Hoje é ${now.long} (${today}). Mural: "${board.name}". Colunas em ordem: ${columns.map((c: any) => c.title + (c.is_conclusion ? ' (conclusão)' : '')).join(', ')}.`,
  ].join('\n');
  try {
    const res = await claudeUser(ctx.apiKey, ctx.model, { max_tokens: 6000, output_config: { effort: 'low' }, system, messages: [{ role: 'user', content: `Cards (${list.length}):\n${lines.slice(0, 80000)}` }] });
    if (res.stop_reason === 'refusal') return { text: 'A IA não pôde resumir este mural.' };
    await markUse(ctx.cid);
    return { text: textOf(res).slice(0, 8000) };
  } catch (e) { const d = (e as Error).message; await markUse(ctx.cid, d); throw new UserError(aiHint(d), 502); }
}

const CARDS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['cards'],
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'description', 'priority', 'due_date', 'assignee', 'column', 'subtasks'],
        properties: {
          title: { type: 'string', description: 'Título curto e claro (até ~120 caracteres).' },
          description: { type: 'string', description: 'Contexto e o que precisa ser feito; vazio se não houver.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          due_date: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }], description: 'AAAA-MM-DD ou null.' },
          assignee: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Nome exatamente como na lista de pessoas, ou null.' },
          column: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Nome de uma coluna existente, ou null para a primeira.' },
          subtasks: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

async function cardsFromText(req: Request, body: any) {
  const ctx = await userCtx(req);
  const text = String(body.text || '').trim();
  if (text.length < 5) throw new UserError('Escreva ou cole um texto com o que precisa ser feito.');
  if (text.length > 30000) throw new UserError('O texto é muito longo (máximo 30.000 caracteres).');
  const { board, columns } = await boardContext(ctx, String(body.board_id || ''));
  const { data: people } = await admin.from('profiles').select('name, display_name').eq('company_id', ctx.cid).eq('is_active', true).neq('profile_type', 'system').limit(300);
  const peopleList = (people || []).map((p: any) => p.display_name || p.name);
  const now = brNow();
  const system = [
    'Você transforma textos (atas, e-mails, anotações, listas) em cards de tarefas para um mural kanban da plataforma ewvon. Escreva em português do Brasil.',
    'Crie um card para cada ação concreta que alguém precisa executar; ignore conversa e informações sem ação. Junte itens repetidos. No máximo 30 cards.',
    'Título objetivo começando por verbo quando possível. Descrição com o contexto útil do texto (ou vazia). Subtarefas só quando o item tiver etapas claras.',
    'Prioridade: urgent só para urgências explícitas; high para itens importantes ou com prazo curto; low para itens opcionais; senão medium.',
    'Prazo (due_date) só quando o texto indicar uma data ou um prazo relativo ("até sexta", "amanhã"); calcule a partir de hoje. Senão null.',
    'Responsável (assignee) só quando o texto disser quem fará e o nome estiver na lista de pessoas (use o nome exatamente como está na lista). Senão null.',
    `Hoje é ${now.long} (${now.iso}). Mural: "${board.name}". Colunas: ${columns.map((c: any) => c.title).join(', ') || 'nenhuma'}.`,
    `Pessoas: ${peopleList.join(', ')}.`,
  ].join('\n');
  try {
    const res = await claudeUser(ctx.apiKey, ctx.model, { max_tokens: 16000, output_config: { effort: 'medium', format: { type: 'json_schema', schema: CARDS_SCHEMA } }, system, messages: [{ role: 'user', content: `Texto:\n"""\n${text}\n"""` }] });
    if (res.stop_reason === 'refusal') throw new UserError('A IA não pôde transformar este texto em cards.', 422);
    if (res.stop_reason === 'max_tokens') throw new UserError('O texto gerou cards demais. Divida o texto em partes menores.', 422);
    let parsed: any; try { parsed = JSON.parse(textOf(res)); } catch { throw new UserError('A IA não devolveu uma lista de cards válida. Tente novamente.', 502); }
    await markUse(ctx.cid);
    const cards = (Array.isArray(parsed?.cards) ? parsed.cards : []).slice(0, 30).map((c: any) => ({
      title: String(c.title || '').trim().slice(0, 200), description: String(c.description || '').trim().slice(0, 4000),
      priority: ['low', 'medium', 'high', 'urgent'].includes(c.priority) ? c.priority : 'medium',
      due_date: typeof c.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.due_date) ? c.due_date : null,
      assignee: typeof c.assignee === 'string' && c.assignee.trim() ? c.assignee.trim() : null,
      column: typeof c.column === 'string' && c.column.trim() ? c.column.trim() : null,
      subtasks: (Array.isArray(c.subtasks) ? c.subtasks : []).map((s: unknown) => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 15),
    })).filter((c: any) => c.title);
    return { cards };
  } catch (e) {
    if (e instanceof UserError) throw e;
    const d = (e as Error).message; await markUse(ctx.cid, d); throw new UserError(aiHint(d), 502);
  }
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  if (route === 'summarize_chat' || route === 'summarize_board' || route === 'cards_from_text') {
    try {
      const body = await req.json().catch(() => ({}));
      const out = route === 'summarize_chat' ? await summarizeChat(req, body) : route === 'summarize_board' ? await summarizeBoard(req, body) : await cardsFromText(req, body);
      return reply(out);
    } catch (e) {
      if (e instanceof UserError) return reply({ error: e.message, code: e.status });   // 200 so the app reads the message
      console.error('ewvon-ai user', (e as Error).message);
      return reply({ error: 'Erro interno.' }, 500);
    }
  }
  try {
    if (route === 'ask') {
      const { data: ok } = await admin.rpc('integrations_secret_ok', { _secret: req.headers.get('x-integrations-secret') || '' });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      const { table, id } = await req.json().catch(() => ({}));
      if (typeof table !== 'string' || typeof id !== 'string') return reply({ error: 'bad request' }, 400);
      // answer right away (the database call has a short timeout) and keep working in the background
      const work = handleAsk(table, id).catch((e) => console.error('ewvon-ai ask', (e as Error).message));
      try { (globalThis as any).EdgeRuntime.waitUntil(work); } catch { await work; }
      return reply({ ok: true });
    }
    const who = await companyAdmin(req);
    if (!who) return reply({ error: 'Somente o administrador da empresa pode configurar a IA.' }, 403);
    const body = await req.json().catch(() => ({}));
    if (route === 'save') {
      const apiKey = typeof body.key === 'string' && body.key.trim() ? body.key.trim() : undefined;
      const { data: existing } = await admin.from('company_integrations').select('id, secret_enc, config').eq('company_id', who.companyId).eq('provider', 'claude').maybeSingle();
      if (!apiKey && !existing?.secret_enc) return reply({ error: 'Cole a chave de API do Claude.' }, 400);
      if (apiKey && !/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(apiKey)) return reply({ error: 'Essa chave não parece ser do Claude (ela começa com sk-ant-).' }, 400);
      const model = MODELS.includes(body.model) ? body.model : (existing?.config?.model || DEFAULT_MODEL);
      const daily = Math.min(Math.max(Math.round(Number(body.daily_limit) || existing?.config?.daily_limit || 30), 1), 500);
      if (apiKey) {   // check the key with a tiny request before saving it
        try { await claude(apiKey, { model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'oi' }] }); }
        catch (e) { return reply({ error: /^401|^403/.test((e as Error).message) ? 'A Anthropic recusou essa chave. Confira se ela está correta e ativa.' : `Não foi possível validar a chave: ${(e as Error).message}` }, 400); }
      }
      const row: any = { company_id: who.companyId, provider: 'claude', enabled: body.enabled !== false, events: [], config: { model, daily_limit: daily, hint: apiKey ? '…' + apiKey.slice(-4) : existing?.config?.hint ?? '' }, updated_by: who.userId, updated_at: new Date().toISOString() };
      if (apiKey) { row.secret_enc = await seal(apiKey); row.last_status = 'ok'; row.last_error = null; }
      const { error } = await admin.from('company_integrations').upsert(row, { onConflict: 'company_id,provider' });
      if (error) return reply({ error: 'Não foi possível salvar.' }, 500);
      return reply({ ok: true });
    }
    if (route === 'remove') {
      await admin.from('company_integrations').delete().eq('company_id', who.companyId).eq('provider', 'claude');
      return reply({ ok: true });
    }
    return reply({ error: 'not found' }, 404);
  } catch (e) {
    console.error('ewvon-ai', (e as Error).message);
    return reply({ error: 'Erro interno.' }, 500);
  }
});
