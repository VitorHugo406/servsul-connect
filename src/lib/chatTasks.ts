// Board tasks from the chat (mobile and desktop): list the boards the user can
// access, create a task in a column and move a task between columns, with the
// same completion/auto-assign rules as the task board. The conversation flag
// "Tarefas pelo chat" lives in chat_settings.
import { supabase } from '@/integrations/supabase/client';
import { withCompany } from '@/lib/companyScope';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ChatBoard { id: string; name: string }
export interface ChatColumn { id: string; title: string; color: string; position: number; is_conclusion: boolean; auto_assign_to: string | null; auto_cover: string | null }
export interface ChatTask { id: string; task_number: number; title: string; status: string; priority: string; due_date: string | null; assigned_to: string | null; completed_at: string | null }

export const PRIORITY_LABEL: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

/** Canonical key shared by everyone in the conversation. */
export function chatSettingsKey(kind: 'sector' | 'dm' | 'group', id: string, meProfileId: string): string {
  if (kind !== 'dm') return `${kind}:${id}`;
  const [a, b] = [meProfileId, id].sort();
  return `dm:${a}:${b}`;
}

export async function getTasksEnabled(key: string): Promise<boolean> {
  const r = await sb.from('chat_settings').select('tasks_enabled').eq('chat_key', key).maybeSingle();
  return !!r.data?.tasks_enabled;
}

export async function canManageChat(key: string): Promise<boolean> {
  const r = await sb.rpc('can_manage_chat', { _key: key });
  return r.data === true;
}

export async function setTasksEnabled(key: string, enabled: boolean, companyId: string) {
  const r = await sb.from('chat_settings').upsert(
    { chat_key: key, company_id: companyId, tasks_enabled: enabled, updated_at: new Date().toISOString() },
    { onConflict: 'company_id,chat_key' },
  );
  if (r.error) throw r.error;
}

export function subscribeChatSettings(key: string, onChange: (enabled: boolean) => void): () => void {
  const ch = sb.channel(`chat-settings-${key}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_settings', filter: `chat_key=eq.${key}` }, (p: { new?: { tasks_enabled?: boolean } }) => onChange(!!p.new?.tasks_enabled))
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}

/** Boards visible to the user (RLS limits task_boards to owned/member boards). */
export async function listBoards(): Promise<ChatBoard[]> {
  const r = await sb.from('task_boards').select('id,name').order('name');
  if (r.error) throw r.error;
  return r.data || [];
}

export async function listColumns(boardId: string): Promise<ChatColumn[]> {
  const r = await sb.from('task_board_columns').select('id,title,color,position,is_conclusion,auto_assign_to,auto_cover').eq('board_id', boardId).order('position');
  if (r.error) throw r.error;
  return r.data || [];
}

export async function listTasks(boardId: string): Promise<ChatTask[]> {
  const r = await sb.from('tasks').select('id,task_number,title,status,priority,due_date,assigned_to,completed_at')
    .eq('board_id', boardId).eq('is_archived', false).order('updated_at', { ascending: false }).limit(300);
  if (r.error) throw r.error;
  return r.data || [];
}

const runAutomations = (boardId: string) => {
  void sb.functions.invoke('process-automations', { body: { board_id: boardId } }).catch(() => undefined);
};

export async function createTask(input: { boardId: string; column: ChatColumn; title: string; description?: string; priority?: string; dueDate?: string | null; assignedTo?: string | null; meProfileId: string }): Promise<ChatTask> {
  const count = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('board_id', input.boardId).eq('status', input.column.id).eq('is_archived', false);
  const row: Record<string, unknown> = {
    title: input.title.trim().slice(0, 200), description: input.description?.trim() || null, status: input.column.id, board_id: input.boardId,
    created_by: input.meProfileId, priority: input.priority || 'medium', position: count.count || 0,
    assigned_to: input.assignedTo || input.column.auto_assign_to || null, due_date: input.dueDate || null,
  };
  if (input.column.auto_cover) row.cover_image = input.column.auto_cover;
  const r = await sb.from('tasks').insert(withCompany(row)).select('id,task_number,title,status,priority,due_date,assigned_to,completed_at').single();
  if (r.error) throw r.error;
  void sb.rpc('log_task_activity_secure', { _task_id: r.data.id, _action_type: 'created', _description: 'Tarefa criada pelo chat', _metadata: { source: 'chat' } }).catch?.(() => undefined);
  runAutomations(input.boardId);
  return r.data;
}

export async function moveTask(task: ChatTask, boardId: string, target: ChatColumn, from?: ChatColumn | null): Promise<void> {
  const count = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('board_id', boardId).eq('status', target.id).eq('is_archived', false);
  const updates: Record<string, unknown> = { status: target.id, position: count.count || 0 };
  if (target.auto_assign_to) updates.assigned_to = target.auto_assign_to;
  if (target.auto_cover) updates.cover_image = target.auto_cover;
  if (target.is_conclusion) {
    updates.completed_at = new Date().toISOString();
    if (task.due_date) {
      const due = new Date(task.due_date); const now = new Date();
      due.setHours(0, 0, 0, 0); now.setHours(0, 0, 0, 0);
      const diff = Math.ceil((now.getTime() - due.getTime()) / 864e5);
      updates.completed_late = diff > 0; updates.delay_days = diff > 0 ? diff : 0;
    } else { updates.completed_late = false; updates.delay_days = 0; }
  } else if (from?.is_conclusion) {
    updates.completed_at = null; updates.completed_late = false; updates.delay_days = 0;
  }
  const r = await sb.from('tasks').update(updates).eq('id', task.id);
  if (r.error) throw r.error;
  void sb.rpc('log_task_activity_secure', { _task_id: task.id, _action_type: 'moved', _description: `Movida para ${target.title} pelo chat`, _metadata: { source: 'chat', from: from?.title, to: target.title } }).catch?.(() => undefined);
  runAutomations(boardId);
}

/** Same text format as CardMentionPicker, so every chat renders it as a task card. */
export function cardMessage(task: ChatTask, boardName: string, header: string, description?: string): string {
  if (task.task_number == null) return `${header}\n📋 ${task.title}\n📌 Mural: ${boardName}`;
  let msg = `${header}\n📋 Card #${task.task_number} — ${task.title}`;
  if (description) msg += `\n📝 ${description}`;
  msg += `\n⚡ Prioridade: ${PRIORITY_LABEL[task.priority] || 'Média'}`;
  if (task.due_date) msg += `\n📅 Prazo: ${new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  msg += `\n📌 Mural: ${boardName}`;
  return msg;
}
