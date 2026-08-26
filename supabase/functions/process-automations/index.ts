import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let boardId: string | null = null;
    try { boardId = (await req.json())?.board_id ?? null; } catch { /* body optional */ }
    const now = new Date();

    let rulesQuery = admin.from('task_automation_rules').select('id, board_id, task_id, trigger_type, trigger_config, action_type, action_config').eq('is_active', true);
    if (boardId) rulesQuery = rulesQuery.eq('board_id', boardId);
    const { data: rules, error: rulesError } = await rulesQuery;
    if (rulesError) throw rulesError;

    const boardIds = [...new Set((rules ?? []).map((r) => r.board_id).filter(Boolean))];
    let tasksQuery = admin.from('tasks').select('id, title, task_number, assigned_to, board_id, due_date, updated_at, status, is_archived').eq('is_archived', false);
    if (boardIds.length) tasksQuery = tasksQuery.in('board_id', boardIds);
    if (boardId) tasksQuery = tasksQuery.eq('board_id', boardId);
    const { data: tasks = [], error: tasksError } = await tasksQuery;
    if (tasksError) throw tasksError;

    const taskIds = tasks.map((task) => task.id);
    const [{ data: subtasks = [] }, { data: assignments = [] }] = await Promise.all([
      taskIds.length ? admin.from('task_subtasks').select('task_id, is_completed').in('task_id', taskIds) : Promise.resolve({ data: [] }),
      taskIds.length ? admin.from('task_label_assignments').select('task_id, task_labels(name)').in('task_id', taskIds) : Promise.resolve({ data: [] }),
    ]);
    const subtasksByTask = new Map<string, { is_completed: boolean }[]>();
    for (const row of subtasks as any[]) subtasksByTask.set(row.task_id, [...(subtasksByTask.get(row.task_id) ?? []), row]);
    const labelsByTask = new Map<string, any[]>();
    for (const row of assignments as any[]) labelsByTask.set(row.task_id, [...(labelsByTask.get(row.task_id) ?? []), row]);
    const profiles = [...new Set(tasks.map((task) => task.assigned_to).filter(Boolean))];
    const { data: profileRows = [] } = profiles.length ? await admin.from('profiles').select('id, user_id').in('id', profiles) : { data: [] };
    const userByProfile = new Map((profileRows as any[]).map((profile) => [profile.id, profile.user_id]));

    const alerts: any[] = [];
    const notificationRows: any[] = [];
    let processed = 0;
    const candidates = (rules ?? []).flatMap((rule) => tasks.filter((task) => rule.task_id ? task.id === rule.task_id : task.board_id === rule.board_id).map((task) => ({ rule, task })));
    for (const { rule, task } of candidates) {
      let triggered = false;
      if (rule.trigger_type === 'deadline_approaching' && task.due_date) { const hours = (new Date(task.due_date).getTime() - now.getTime()) / 36e5; triggered = hours > 0 && hours <= (rule.trigger_config?.hours ?? 24); }
      if (rule.trigger_type === 'stuck_days') triggered = (now.getTime() - new Date(task.updated_at).getTime()) / 864e5 >= (rule.trigger_config?.days ?? 3);
      if (rule.trigger_type === 'checklist_complete') { const rows = subtasksByTask.get(task.id) ?? []; triggered = rows.length > 0 && rows.every((row) => row.is_completed); }
      if (rule.trigger_type === 'label_urgent') triggered = (labelsByTask.get(task.id) ?? []).some((row) => { const name = row.task_labels?.name?.toLowerCase() ?? ''; return name.includes('urgent') || name.includes('urgente'); });
      if (!triggered) continue;
      if (rule.action_type === 'notify' && task.assigned_to && userByProfile.has(task.assigned_to)) notificationRows.push({ user_id: userByProfile.get(task.assigned_to), type: 'automation', title: 'Automação ativada', message: `Regra "${rule.trigger_type}" ativada no card #${task.task_number} "${task.title}"`, reference_id: task.id });
      if (rule.action_type === 'move_column' && rule.action_config?.column_id && task.status !== rule.action_config.column_id) { await admin.from('tasks').update({ status: rule.action_config.column_id, position: 0 }).eq('id', task.id); processed++; }
      if (rule.action_type === 'set_priority' && rule.action_config?.priority) { await admin.from('tasks').update({ priority: rule.action_config.priority }).eq('id', task.id).neq('priority', rule.action_config.priority); processed++; }
      if (rule.action_type === 'alert' && task.assigned_to) { alerts.push({ profile_id: task.assigned_to, board_id: rule.board_id, alert_type: rule.trigger_type === 'deadline_approaching' ? 'deadline_risk' : rule.trigger_type === 'stuck_days' ? 'stuck_task' : 'late_task', message: `Card #${task.task_number} "${task.title}" requer atenção`, task_id: task.id }); processed++; }
    }

    const counts = new Map<string, { count: number; board_id: string | null }>();
    for (const task of tasks) if (task.assigned_to) { const current = counts.get(task.assigned_to) ?? { count: 0, board_id: task.board_id }; current.count++; counts.set(task.assigned_to, current);         if (task.due_date) { const overdue = now.getTime() - new Date(task.due_date).getTime(); alerts.push(overdue > 0 ? { profile_id: task.assigned_to, board_id: task.board_id, alert_type: 'late_task', message: `Card #${task.task_number} "${task.title}" está atrasado`, task_id: task.id } : overdue > -48 * 36e5 ? { profile_id: task.assigned_to, board_id: task.board_id, alert_type: 'deadline_risk', message: `Card #${task.task_number} "${task.title}" vence em breve`, task_id: task.id } : null); }
        if ((now.getTime() - new Date(task.updated_at).getTime()) / 864e5 >= 3) alerts.push({ profile_id: task.assigned_to, board_id: task.board_id, alert_type: 'stuck_task', message: `Card #${task.task_number} "${task.title}" está parado há muito tempo`, task_id: task.id }); }
    for (const [profile_id, value] of counts) if (value.count >= 5) alerts.push({ profile_id, board_id: value.board_id, alert_type: 'overloaded', message: `Colaborador com ${value.count} cards ativos — possível sobrecarga`, task_id: null });
    const validAlerts = alerts.filter(Boolean);
    if (notificationRows.length) await admin.from('user_notifications').insert(notificationRows);
    if (validAlerts.length) {
      const keys = new Set(validAlerts.map((a) => `${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      const { data: existing = [] } = await admin.from('workload_alerts').select('profile_id, alert_type, task_id').in('profile_id', [...new Set(validAlerts.map((a) => a.profile_id))]).gte('created_at', new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString());
      const existingKeys = new Set((existing as any[]).map((a) => `${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      const fresh = validAlerts.filter((a) => keys.has(`${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`) && !existingKeys.has(`${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      if (fresh.length) await admin.from('workload_alerts').insert(fresh);
    }
    return json({ processed, alerts: validAlerts.length });
  } catch (error) { console.error('Error processing automations:', error); return json({ error: 'Erro interno do servidor' }, 500); }
});
