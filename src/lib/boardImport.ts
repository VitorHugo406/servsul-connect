// Import a board from other tools into an ewvon mural.
//  - Trello: the JSON from "Menu › Imprimir, exportar e compartilhar › Exportar como JSON" (lists, cards, labels,
//    checklists, comments, members, due dates; archived lists/cards are skipped).
//  - ClickUp / Asana / any spreadsheet: CSV with a header row; columns are recognised by name (task name, status/section,
//    description, due date, priority, assignee, tags, checklist/subtasks).
// Everything becomes a normal mural: columns, cards (status = column id), labels, checklists (subtask groups), comments and
// assignees matched by e-mail or name to people of the company. Nothing is sent anywhere else.
import { supabase } from '@/integrations/supabase/client';
import { withCompany } from '@/lib/companyScope';

export interface ImpItem { t: string; done: boolean }
export interface ImpCard {
  title: string; desc: string; col: number; due: string | null; start?: string | null; done: boolean; priority: 'low' | 'medium' | 'high' | 'urgent';
  labels: number[]; checklists: { title: string; items: ImpItem[] }[]; comments: { who: string; text: string; at: string | null }[];
  people: string[];   // e-mails or names to match
}
export interface ImpBoard { doneCol?: number; source: string; name: string; desc: string; columns: { title: string; color: string }[]; labels: { name: string; color: string }[]; cards: ImpCard[] }

const TRELLO_COLORS: Record<string, string> = {
  green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444', purple: '#8b5cf6', blue: '#3b82f6', sky: '#0ea5e9',
  lime: '#84cc16', pink: '#ec4899', black: '#374151',
};
const COL_COLORS = ['#6b7280', '#3b82f6', '#eab308', '#8b5cf6', '#f97316', '#0ea5e9', '#ec4899', '#22c55e'];
const DONE_RE = /^(conclu|done|complete|finaliz|feito|closed|fechad|entregue)/i;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const toIso = (v: unknown) => { if (!v) return null; const s = String(v).trim(); if (!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (br) { const y = br[3].length === 2 ? 2000 + +br[3] : +br[3]; const d = new Date(y, +br[2] - 1, +br[1], 12); return isNaN(+d) ? null : d.toISOString(); }
  const n = Number(s); const d = /^\d{11,13}$/.test(s) ? new Date(n) : new Date(s); return isNaN(+d) ? null : d.toISOString(); };
const prio = (v: unknown): ImpCard['priority'] => { const s = fold(String(v || '')); if (/urgen|critic/.test(s)) return 'urgent'; if (/alt|high/.test(s)) return 'high'; if (/baix|low/.test(s)) return 'low'; return 'medium'; };

/** Trello board JSON → ImpBoard. Throws a friendly error when it is not a Trello export. */
export function parseTrello(json: any): ImpBoard {
  if (!json || !Array.isArray(json.lists) || !Array.isArray(json.cards)) throw new Error('Este arquivo não parece uma exportação do Trello (JSON do quadro).');
  const lists = json.lists.filter((l: any) => !l.closed).sort((a: any, b: any) => (a.pos ?? 0) - (b.pos ?? 0));
  const colIdx = new Map<string, number>(lists.map((l: any, i: number) => [l.id, i]));
  const labels = (json.labels || []).filter((l: any) => l.name || l.color);
  const labIdx = new Map<string, number>(labels.map((l: any, i: number) => [l.id, i]));
  const members = new Map<string, string>((json.members || []).map((m: any) => [m.id, m.fullName || m.username || '']));
  const checklists = new Map<string, any[]>();
  for (const c of json.checklists || []) { const a = checklists.get(c.idCard) || []; a.push(c); checklists.set(c.idCard, a); }
  const comments = new Map<string, ImpCard['comments']>();
  for (const a of json.actions || []) {
    if (a.type !== 'commentCard' || !a.data?.card?.id || !a.data?.text) continue;
    const arr = comments.get(a.data.card.id) || []; arr.push({ who: a.memberCreator?.fullName || 'Alguém', text: String(a.data.text), at: a.date || null }); comments.set(a.data.card.id, arr);
  }
  const cards: ImpCard[] = json.cards.filter((c: any) => !c.closed && colIdx.has(c.idList)).sort((a: any, b: any) => (a.pos ?? 0) - (b.pos ?? 0)).map((c: any) => {
    const col = colIdx.get(c.idList)!;
    return {
      title: String(c.name || 'Sem título').slice(0, 300), desc: String(c.desc || ''), col, due: toIso(c.due), done: !!c.dueComplete || DONE_RE.test(lists[col].name || ''),
      priority: 'medium', labels: (c.idLabels || []).map((id: string) => labIdx.get(id)).filter((x: number | undefined): x is number => x != null),
      checklists: (checklists.get(c.id) || []).map((cl: any) => ({ title: String(cl.name || 'Checklist'), items: (cl.checkItems || []).sort((a: any, b: any) => (a.pos ?? 0) - (b.pos ?? 0)).map((it: any) => ({ t: String(it.name || ''), done: it.state === 'complete' })) })),
      comments: (comments.get(c.id) || []).reverse(), people: (c.idMembers || []).map((id: string) => members.get(id) || '').filter(Boolean),
    };
  });
  return { source: 'Trello', name: String(json.name || 'Mural importado'), desc: String(json.desc || ''),
    columns: lists.map((l: any, i: number) => ({ title: String(l.name || `Coluna ${i + 1}`).slice(0, 80), color: DONE_RE.test(l.name || '') ? '#22c55e' : COL_COLORS[i % COL_COLORS.length] })),
    labels: labels.map((l: any) => ({ name: String(l.name || l.color || 'Etiqueta').slice(0, 50), color: TRELLO_COLORS[String(l.color || '').split('_')[0]] || '#6b7280' })), cards };
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF, ; or , separators). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, ''); const first = t.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const H = {
  title: ['task name', 'name', 'nome', 'tarefa', 'titulo', 'title', 'card name', 'task'],
  col: ['status', 'section/column', 'section', 'column', 'coluna', 'lista', 'list', 'secao', 'etapa', 'list name'],
  desc: ['description', 'task content', 'notes', 'descricao', 'notas', 'content', 'card description'],
  due: ['due date', 'due', 'prazo', 'data de entrega', 'vencimento', 'data limite', 'deadline', 'date', 'data'],
  prio: ['priority', 'prioridade'],
  who: ['assignee email', 'assignees', 'assignee', 'assigned to', 'responsavel', 'responsaveis', 'members', 'membros', 'person', 'pessoa', 'people', 'owner', 'assign', 'dono'],
  tags: ['tags', 'labels', 'etiquetas', 'label', 'group', 'grupo'],
  done: ['completed at', 'date done', 'completed', 'concluido em', 'done'],
  check: ['checklists', 'checklist', 'subtasks', 'subtarefas'],
};

/** CSV from ClickUp, Asana, Trello CSV or a spreadsheet → ImpBoard (columns from the status/section column). */
export function parseCsvBoard(text: string, fileName: string): ImpBoard { return parseRowsBoard(parseCsv(text), fileName); }

/** monday.com exports one block per group: [group name] / header row / items / blank. Flattens it into one table with a
 *  "Group" column (used as a label) so the generic parser below can read it. Other sheets pass through unchanged. */
function flattenGroups(rows: string[][]): { rows: string[][]; grouped: boolean } {
  const isHead = (r: string[]) => /^(name|nome|item)$/.test(fold(r[0] || '')) && r.filter((c) => c.trim()).length >= 2;
  const heads = rows.map((r, i) => (isHead(r) ? i : -1)).filter((i) => i >= 0);
  if (heads.length < 2 && !(heads.length === 1 && heads[0] > 0)) return { rows, grouped: false };
  const header = rows[heads[0]]; const out: string[][] = [[...header, 'Group']];
  let cur: string[] = header; let group = '';
  rows.forEach((r, i) => {
    if (isHead(r)) { cur = r; const prev = rows[i - 1]; group = prev && prev.filter((c) => c.trim()).length === 1 ? prev.find((c) => c.trim())!.trim() : group; return; }
    if (i < heads[0] || !r[0]?.trim() || (rows[i + 1] && isHead(rows[i + 1]) && r.filter((c) => c.trim()).length === 1)) return;
    out.push([...header.map((h) => { const j = cur.findIndex((x) => fold(x) === fold(h)); return j >= 0 ? r[j] ?? '' : ''; }), group]);
  });
  return { rows: out, grouped: true };
}

/** Rows (first = header) from a CSV or a spreadsheet → ImpBoard. */
export function parseRowsBoard(input: string[][], fileName: string, hint?: string): ImpBoard {
  const flat = flattenGroups(input); const rows = flat.rows;
  if (rows.length < 2) throw new Error('A planilha está vazia ou sem cabeçalho.');
  const head = rows[0].map((h) => fold(h));
  const find = (k: keyof typeof H) => { for (const n of H[k]) { const i = head.indexOf(n); if (i >= 0) return i; } return head.findIndex((h) => H[k].some((n) => h.includes(n))); };
  const ix = { title: find('title'), col: find('col'), desc: find('desc'), due: find('due'), prio: find('prio'), who: find('who'), tags: find('tags'), done: find('done'), check: find('check') };
  if (ix.title < 0) throw new Error('Não encontrei a coluna com o nome da tarefa (ex.: "Task Name", "Name" ou "Nome").');
  const cols: string[] = []; const labs: string[] = [];
  const colOf = (v: string) => { const n = (v || '').trim() || 'A Fazer'; let i = cols.findIndex((c) => fold(c) === fold(n)); if (i < 0) { cols.push(n); i = cols.length - 1; } return i; };
  const labOf = (v: string) => { let i = labs.findIndex((c) => fold(c) === fold(v)); if (i < 0) { labs.push(v); i = labs.length - 1; } return i; };
  const g = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const cards: ImpCard[] = rows.slice(1).filter((r) => g(r, ix.title)).map((r) => {
    const col = colOf(g(r, ix.col));
    const items = g(r, ix.check).split(/\n|;|\|/).map((s) => s.trim()).filter(Boolean).map((s) => ({ t: s.replace(/^\[[ xX]\]\s*/, ''), done: /^\[[xX]\]/.test(s) }));
    return {
      title: g(r, ix.title).slice(0, 300), desc: g(r, ix.desc), col, due: toIso(g(r, ix.due)), done: !!g(r, ix.done) || DONE_RE.test(cols[col]),
      priority: prio(g(r, ix.prio)), labels: g(r, ix.tags).split(/[,;|]/).map((s) => s.trim()).filter(Boolean).map(labOf),
      checklists: items.length ? [{ title: 'Checklist', items }] : [], comments: [], people: g(r, ix.who).split(/[,;|]/).map((s) => s.trim()).filter(Boolean),
    };
  });
  if (!cards.length) throw new Error('Nenhuma tarefa encontrada na planilha.');
  const src = hint || (/monday/i.test(fileName) || flat.grouped ? 'monday.com' : /notion/i.test(fileName) || head.includes('created time') || head.includes('last edited time') ? 'Notion' : /clickup/i.test(fileName) || head.includes('task id') ? 'ClickUp' : head.includes('section/column') ? 'Asana' : 'Planilha');
  return { source: src, name: fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Mural importado', desc: '',
    columns: cols.map((c, i) => ({ title: c.slice(0, 80), color: DONE_RE.test(c) ? '#22c55e' : COL_COLORS[i % COL_COLORS.length] })),
    labels: labs.map((l, i) => ({ name: l.slice(0, 50), color: COL_COLORS[(i + 3) % COL_COLORS.length] })), cards };
}

export async function readBoardFile(file: File): Promise<ImpBoard> {
  if (file.size > 30 * 1024 * 1024) throw new Error('Arquivo grande demais (máximo 30 MB).');
  if (/\.xlsx?$/i.test(file.name)) {
    const { readSheet } = await import('@/lib/exportTable');
    let rows: string[][]; try { rows = await readSheet(file); } catch { throw new Error('Não consegui ler a planilha do Excel.'); }
    return parseRowsBoard(rows.filter((r) => r.some((c) => String(c).trim())), file.name);
  }
  const text = await file.text();
  if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
    let j: unknown; try { j = JSON.parse(text); } catch { throw new Error('O arquivo JSON está corrompido.'); }
    return parseTrello(j);
  }
  return parseCsvBoard(text, file.name);
}

type Person = { id: string; user_id: string; name: string; display_name: string | null; email: string | null };
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Creates the mural and everything in it. Reports progress 0..1. Returns the new board id. */
export async function importBoard(b: ImpBoard, me: { userId: string; profileId: string; companyId: string }, name: string, onProgress: (f: number, msg: string) => void): Promise<{ boardId: string; cards: number; matched: number }> {
  onProgress(0.02, 'Criando o mural');
  const { data: board, error } = await supabase.from('task_boards').insert(withCompany({ name: name.slice(0, 120), description: (b.desc || `Importado do ${b.source}`).slice(0, 500), owner_id: me.userId })).select('id').single();
  if (error || !board) throw new Error('Não foi possível criar o mural.');
  const boardId = (board as { id: string }).id;
  await supabase.from('task_board_members').insert({ board_id: boardId, user_id: me.userId, profile_id: me.profileId, role: 'owner' });

  const lastDone = b.doneCol ?? b.columns.map((c) => DONE_RE.test(c.title)).lastIndexOf(true);
  const { data: cols, error: ce } = await supabase.from('task_board_columns').insert(b.columns.map((c, i) => ({ board_id: boardId, title: c.title, color: c.color, position: i, is_conclusion: i === lastDone }))).select('id,position');
  if (ce || !cols) throw new Error('Não foi possível criar as colunas.');
  const colId = (cols as { id: string; position: number }[]).sort((x, y) => x.position - y.position).map((c) => c.id);

  let labId: string[] = [];
  if (b.labels.length) {
    const { data: labs } = await supabase.from('task_labels').insert(b.labels.map((l) => ({ board_id: boardId, name: l.name, color: l.color }))).select('id,name');
    const byName = new Map(((labs || []) as { id: string; name: string }[]).map((l) => [l.name, l.id]));
    labId = b.labels.map((l) => byName.get(l.name) || '');
  }

  // people of the company, matched by e-mail or full name (accents/case ignored)
  const { data: ppl } = await supabase.from('profiles').select('id,user_id,name,display_name,email').eq('company_id', me.companyId).eq('is_active', true);
  const people = (ppl || []) as Person[];
  const match = (v: string) => { const f = fold(v); return people.find((p) => (p.email && fold(p.email) === f) || fold(p.name) === f || (p.display_name && fold(p.display_name) === f)) || null; };
  const matchedIds = new Set<string>();

  const perCol = new Map<number, number>(); const now = new Date().toISOString();
  const rows = b.cards.map((c) => {
    const pos = perCol.get(c.col) || 0; perCol.set(c.col, pos + 1);
    const first = c.people.map(match).find(Boolean) || null;
    return withCompany({ board_id: boardId, title: c.title, description: c.desc || null, status: colId[c.col], priority: c.priority, due_date: c.due, ...(c.start ? { start_date: c.start } : {}), position: pos, created_by: me.profileId,
      assigned_to: first?.id || null, completed_at: c.done ? (c.due && c.due < now ? c.due : now) : null });
  });
  const ids: string[] = [];
  const parts = chunk(rows, 200);
  for (let i = 0; i < parts.length; i++) {
    onProgress(0.1 + 0.5 * (i / parts.length), `Criando cards (${Math.min((i + 1) * 200, rows.length)} de ${rows.length})`);
    const { data, error: te } = await (supabase as any).from('tasks').insert(parts[i]).select('id');
    if (te || !data) throw new Error('Não foi possível criar os cards.');
    ids.push(...(data as { id: string }[]).map((x) => x.id));
  }

  onProgress(0.65, 'Etiquetas, responsáveis e membros');
  const la: { task_id: string; label_id: string }[] = []; const asg: { task_id: string; profile_id: string }[] = [];
  b.cards.forEach((c, i) => {
    for (const l of new Set(c.labels)) if (labId[l]) la.push({ task_id: ids[i], label_id: labId[l] });
    for (const p of new Set(c.people.map(match).filter(Boolean).map((x) => x!.id))) { asg.push({ task_id: ids[i], profile_id: p }); matchedIds.add(p); }
  });
  for (const part of chunk(la, 500)) await supabase.from('task_label_assignments').insert(part);
  for (const part of chunk(asg, 500)) await supabase.from('task_assignees').insert(part);
  const members = people.filter((p) => matchedIds.has(p.id) && p.id !== me.profileId).map((p) => ({ board_id: boardId, user_id: p.user_id, profile_id: p.id, role: 'member' }));
  for (const part of chunk(members, 200)) await supabase.from('task_board_members').insert(part);

  onProgress(0.75, 'Checklists');
  const groups: { task_id: string; title: string; position: number; _items: ImpItem[] }[] = [];
  b.cards.forEach((c, i) => c.checklists.forEach((cl, j) => { if (cl.items.length) groups.push({ task_id: ids[i], title: cl.title.slice(0, 120), position: j, _items: cl.items }); }));
  for (const part of chunk(groups, 200)) {
    const { data: gs } = await supabase.from('subtask_groups').insert(part.map(({ _items, ...g }) => g)).select('id');
    const subs = ((gs || []) as { id: string }[]).flatMap((g, k) => part[k]._items.map((it, n) => ({ task_id: part[k].task_id, group_id: g.id, title: it.t.slice(0, 300) || '—', is_completed: it.done, position: n })));
    for (const sp of chunk(subs, 500)) await supabase.from('task_subtasks').insert(sp);
  }

  onProgress(0.9, 'Comentários');
  const cms: { task_id: string; author_id: string; content: string }[] = [];
  b.cards.forEach((c, i) => c.comments.forEach((cm) => cms.push({ task_id: ids[i], author_id: me.profileId,
    content: `💬 ${cm.who}${cm.at ? ` (${new Date(cm.at).toLocaleDateString('pt-BR')})` : ''}: ${cm.text}`.slice(0, 5000) })));
  for (const part of chunk(cms, 500)) await supabase.from('task_comments').insert(part);

  onProgress(1, 'Pronto');
  return { boardId, cards: ids.length, matched: matchedIds.size };
}
