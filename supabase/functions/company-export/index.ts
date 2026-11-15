// Full export of a company's data as a ZIP (users, tasks, messages, announcements, evaluations...).
// Sensitive: only the e-mail that created the company can ask for it (or the billing cron, which e-mails the link to that same address).
//   POST { email?: boolean }              with the owner's login (JWT)  -> { url, expires_at, files, rows }
//   POST { company_id, email: true }      with the billing cron secret  -> same, and the link is e-mailed to the owner
// The ZIP is stored in the private bucket `company-exports`; the link is a signed URL valid for 7 days.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { zipSync, strToU8 } from 'npm:fflate@0.8.2';
import { esc, layout, mailerConfigured, sendMail } from './mailer.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = 'company-exports';
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

type Src = { t: string; by: 'company' } | { t: string; by: 'parent'; fk: string; parent: string };
const DROP: Record<string, string[]> = { hr_sources: ['secret_enc', 'config'], profiles: [] };
const SOURCES: Src[] = [
  { t: 'sectors', by: 'company' }, { t: 'profiles', by: 'company' }, { t: 'teams', by: 'company' },
  { t: 'team_members', by: 'parent', fk: 'team_id', parent: 'teams' },
  { t: 'messages', by: 'company' }, { t: 'direct_messages', by: 'company' }, { t: 'chat_reactions', by: 'company' },
  { t: 'private_groups', by: 'company' }, { t: 'private_group_members', by: 'parent', fk: 'group_id', parent: 'private_groups' },
  { t: 'private_group_messages', by: 'parent', fk: 'group_id', parent: 'private_groups' },
  { t: 'announcements', by: 'company' }, { t: 'announcement_comments', by: 'parent', fk: 'announcement_id', parent: 'announcements' },
  { t: 'important_announcements', by: 'company' },
  { t: 'task_boards', by: 'company' }, { t: 'task_board_columns', by: 'parent', fk: 'board_id', parent: 'task_boards' },
  { t: 'task_board_members', by: 'parent', fk: 'board_id', parent: 'task_boards' }, { t: 'task_labels', by: 'parent', fk: 'board_id', parent: 'task_boards' },
  { t: 'tasks', by: 'company' }, { t: 'subtask_groups', by: 'parent', fk: 'task_id', parent: 'tasks' }, { t: 'task_subtasks', by: 'parent', fk: 'task_id', parent: 'tasks' },
  { t: 'task_comments', by: 'parent', fk: 'task_id', parent: 'tasks' }, { t: 'task_assignees', by: 'parent', fk: 'task_id', parent: 'tasks' },
  { t: 'task_activities', by: 'parent', fk: 'task_id', parent: 'tasks' }, { t: 'task_decisions', by: 'parent', fk: 'task_id', parent: 'tasks' },
  { t: 'task_label_assignments', by: 'parent', fk: 'task_id', parent: 'tasks' },
  { t: 'notes', by: 'company' }, { t: 'calendar_events', by: 'company' },
  { t: 'meeting_rooms', by: 'company' }, { t: 'meeting_bookings', by: 'company' }, { t: 'meeting_booking_participants', by: 'parent', fk: 'booking_id', parent: 'meeting_bookings' },
  { t: 'war_rooms', by: 'company' }, { t: 'war_room_members', by: 'parent', fk: 'war_room_id', parent: 'war_rooms' },
  { t: 'war_room_messages', by: 'parent', fk: 'war_room_id', parent: 'war_rooms' }, { t: 'war_room_timeline', by: 'parent', fk: 'war_room_id', parent: 'war_rooms' },
  { t: 'eval_positions', by: 'company' }, { t: 'eval_competencies', by: 'company' }, { t: 'eval_cycles', by: 'company' }, { t: 'evaluations', by: 'company' },
  { t: 'evaluation_items', by: 'parent', fk: 'evaluation_id', parent: 'evaluations' }, { t: 'evaluation_history', by: 'parent', fk: 'evaluation_id', parent: 'evaluations' },
  { t: 'support_tickets', by: 'company' }, { t: 'hr_sources', by: 'company' }, { t: 'hr_employees', by: 'company' }, { t: 'company_payments', by: 'company' },
];
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const MAX_BYTES = 70 * 1024 * 1024;
const MAX_MS = 110_000;

async function fetchAll(src: Src, cid: string, ids: Map<string, string[]>): Promise<any[]> {
  const out: any[] = [];
  const drop = DROP[src.t] || [];
  const clean = (r: any) => { for (const k of drop) delete r[k]; return r; };
  if (src.by === 'company') {
    for (let from = 0; from < 200_000; from += 1000) {
      const { data, error } = await admin.from(src.t).select('*').eq('company_id', cid).range(from, from + 999);
      if (error) throw new Error(`${src.t}: ${error.message}`);
      out.push(...(data ?? []).filter((r: any) => r.company_id == null || r.company_id === cid).map(clean));
      if ((data ?? []).length < 1000) break;
    }
  } else {
    const parentIds = ids.get(src.parent) || [];
    for (let i = 0; i < parentIds.length; i += 150) {
      const chunk = parentIds.slice(i, i + 150);
      for (let from = 0; from < 100_000; from += 1000) {
        const { data, error } = await admin.from(src.t).select('*').in(src.fk, chunk).range(from, from + 999);
        if (error) throw new Error(`${src.t}: ${error.message}`);
        out.push(...(data ?? []).map(clean));
        if ((data ?? []).length < 1000) break;
      }
    }
  }
  return out;
}

const csvCell = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function toCsv(rows: any[], names: { prof: Map<string, string>; sect: Map<string, string> }): string {
  if (!rows.length) return '';
  const keys: string[] = []; const seen = new Set<string>();
  for (const r of rows.slice(0, 500)) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  const who = new Set(['author_id', 'sender_id', 'receiver_id', 'user_id', 'created_by', 'profile_id', 'assigned_to', 'owner_id']);
  const head = keys.flatMap((k) => (who.has(k) ? [k, k.replace(/_id$/, '') + '_nome'] : k === 'sector_id' ? [k, 'setor'] : [k]));
  const lines = [head.map(csvCell).join(';')];
  for (const r of rows) {
    lines.push(keys.flatMap((k) => (who.has(k) ? [r[k], names.prof.get(String(r[k])) || ''] : k === 'sector_id' ? [r[k], names.sect.get(String(r[k])) || ''] : [r[k]])).map(csvCell).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    let companyId = ''; let wantMail = false; let ownerEmail = '';
    const cronSecret = req.headers.get('x-billing-cron') || '';
    if (cronSecret) {
      const { data: ok } = await admin.rpc('billing_cron_secret_ok', { _secret: cronSecret });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      companyId = String(body.company_id || ''); wantMail = body.email !== false;
      const { data: oe } = await admin.rpc('company_owner_email', { _cid: companyId }); ownerEmail = String(oe || '');
    } else {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
      if (!u?.user) return reply({ error: 'Faça login novamente.' }, 401);
      const { data: prof } = await admin.from('profiles').select('company_id, email').eq('user_id', u.user.id).maybeSingle();
      if (!prof?.company_id) return reply({ error: 'Empresa não encontrada.' }, 404);
      const { data: oe } = await admin.rpc('company_owner_email', { _cid: prof.company_id }); ownerEmail = String(oe || '');
      if (!ownerEmail || String(prof.email || '').toLowerCase() !== ownerEmail) return reply({ error: 'Somente o e-mail que criou a empresa pode baixar os dados.' }, 403);
      companyId = prof.company_id; wantMail = body.email === true;
    }
    if (!/^[0-9a-f-]{36}$/.test(companyId)) return reply({ error: 'Empresa inválida' }, 400);
    const { data: comp } = await admin.from('companies').select('id, name, slug, is_system').eq('id', companyId).maybeSingle();
    if (!comp || comp.is_system) return reply({ error: 'Empresa não encontrada.' }, 404);

    // Same ZIP asked again within 15 minutes: reuse it.
    const { data: existing } = await admin.storage.from(BUCKET).list(companyId, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
    const recent = (existing ?? []).find((f: any) => f.created_at && Date.now() - new Date(f.created_at).getTime() < 15 * 60_000);
    let path = recent ? `${companyId}/${recent.name}` : '';
    let rowsTotal = 0; const notes: string[] = [];
    if (!path) {
      const started = Date.now(); let bytes = 0;
      const files: Record<string, Uint8Array> = {}; const ids = new Map<string, string[]>(); const counts: Record<string, number> = {};
      const names = { prof: new Map<string, string>(), sect: new Map<string, string>() };
      const keep: Record<string, any[]> = {};
      // Safety rail: nothing that mentions ANOTHER company may ever go into this ZIP.
      const { data: allCompanies } = await admin.from('companies').select('id');
      const otherIds = new Set((allCompanies ?? []).map((c: any) => String(c.id)).filter((id: string) => id !== companyId));
      for (const src of SOURCES) {
        if (Date.now() - started > MAX_MS || bytes > MAX_BYTES) { notes.push(`Tabela não incluída por limite de tamanho/tempo: ${src.t}`); continue; }
        let rows: any[] = [];
        try { rows = await fetchAll(src, companyId, ids); } catch (e) { notes.push(`Não foi possível ler ${src.t}: ${(e as Error).message}`); continue; }
        const txt = JSON.stringify(rows);
        if ((txt.match(UUID_RE) || []).some((u) => otherIds.has(u))) { notes.push(`Tabela ${src.t} omitida: continha referência a outra empresa (bloqueado por segurança).`); continue; }
        counts[src.t] = rows.length; rowsTotal += rows.length;
        if (['teams', 'task_boards', 'tasks', 'private_groups', 'announcements', 'meeting_bookings', 'war_rooms', 'evaluations'].includes(src.t)) ids.set(src.t, rows.map((r) => r.id));
        if (src.t === 'profiles') rows.forEach((r) => { const n = r.display_name || r.name || r.email || ''; names.prof.set(String(r.id), n); if (r.user_id) names.prof.set(String(r.user_id), n); });
        if (src.t === 'sectors') rows.forEach((r) => names.sect.set(String(r.id), r.name || ''));
        if (['profiles', 'tasks', 'messages', 'direct_messages', 'announcements', 'notes', 'calendar_events', 'evaluations'].includes(src.t)) keep[src.t] = rows;
        const json = strToU8(txt); bytes += json.length; files[`dados/${src.t}.json`] = json;
      }
      const csvNames: Record<string, string> = { profiles: 'usuarios', tasks: 'tarefas', messages: 'mensagens_dos_setores', direct_messages: 'mensagens_diretas', announcements: 'avisos', notes: 'anotacoes', calendar_events: 'calendario', evaluations: 'avaliacoes' };
      for (const [t, rows] of Object.entries(keep)) { const csv = toCsv(rows, names); if (csv) { const u8 = strToU8(csv); bytes += u8.length; files[`planilhas/${csvNames[t]}.csv`] = u8; } }
      const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      files['LEIA-ME.txt'] = strToU8([
        `DADOS DA EMPRESA ${comp.name} - exportados do ewvon em ${stamp}`, '',
        'ATENÇÃO: este arquivo contém dados sensíveis (pessoas, conversas, tarefas, avaliações). Guarde-o em local seguro e não compartilhe.', '',
        'O que há aqui:',
        '- planilhas/  arquivos .csv que abrem no Excel: usuários, tarefas, mensagens, avisos, anotações, calendário e avaliações.',
        '- dados/      todos os registros completos de cada tabela, em .json (para quem for importar em outro sistema).',
        '- Os anexos (fotos, PDFs, áudios) aparecem apenas como registros; os arquivos em si não vão neste ZIP. Peça ao suporte (ewvonsuporte@gmail.com) se precisar deles.', '',
        'Quantidade de registros: ' + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', '),
        ...(notes.length ? ['', 'Avisos:', ...notes.map((n) => '- ' + n)] : []),
      ].join('\r\n'));
      const zip = zipSync(files, { level: 6 });
      path = `${companyId}/ewvon-dados-${comp.slug}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, zip, { contentType: 'application/zip', upsert: true });
      if (upErr) throw new Error('upload: ' + upErr.message);
    }
    const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(path, 7 * 24 * 3600, { download: true });
    if (sErr || !signed?.signedUrl) throw new Error('link: ' + (sErr?.message || 'falhou'));
    const expires = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    let mailed = false;
    if (wantMail && ownerEmail && mailerConfigured()) {
      try {
        await sendMail({ to: ownerEmail, subject: `ewvon · Os dados da empresa ${comp.name} (ZIP)`, html: layout(`<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
          <h2 style="margin:0 0 10px;font-size:20px">Os dados da empresa ${esc(comp.name)}</h2>
          <p style="margin:0 0 14px;font-size:14px;color:#52525b">Preparamos um arquivo ZIP com todos os dados da empresa no ewvon: usuários, tarefas, mensagens, avisos, anotações, calendário e avaliações (planilhas .csv e registros completos em .json).</p>
          <p style="margin:0 0 18px"><a href="${signed.signedUrl}" style="display:inline-block;background:#14264a;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600">Baixar os dados (ZIP)</a></p>
          <p style="margin:0 0 8px;font-size:13px;color:#71717a">O link vale por 7 dias. Os dados são sensíveis e este e-mail foi enviado somente ao e-mail que criou a empresa: não encaminhe o link.</p>
          <p style="margin:0;font-size:13px;color:#71717a">Você também pode pedir um novo arquivo a qualquer momento ao entrar no ewvon com este e-mail.</p></div>`, 'Seus dados em ZIP') });
        mailed = true;
      } catch (e) { console.error('export mail', e); }
    }
    return reply({ url: signed.signedUrl, expires_at: expires, rows: rowsTotal, emailed: mailed, notes });
  } catch (e) { console.error('company-export', e); return reply({ error: 'Não foi possível gerar o arquivo agora. Tente novamente em instantes.' }, 500); }
});
