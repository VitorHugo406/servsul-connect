import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-billing-cron' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let boardId: string | null = null;
    let scheduled = false;
    let alertsOnly = false;
    try {
      const body = await req.json();
      boardId = body?.board_id ?? null;
      scheduled = body?.time === 'scheduled' || body?.time === 'alerts' || body?.cron === true || body?.scheduled === true;
      alertsOnly = body?.time === 'alerts';
    } catch { /* body optional */ }
    // SECURITY (2026-11-09): it was callable by anyone for every board. Now: the service role
    // (scheduler) for everything, or a signed-in member of ONE board, only for that board.
    const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    // pg_cron (ewvon-team-alerts) authenticates with the shared cron secret kept in Vault
    const cronHeader = req.headers.get('x-billing-cron') || '';
    const cronOk = cronHeader ? (await admin.rpc('billing_cron_secret_ok', { _secret: cronHeader })).data === true : false;
    if (bearer !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') && !cronOk) {
      if (!bearer || !boardId) return json({ error: 'Unauthorized' }, 401);
      const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
      const { data: member, error: memberError } = await asUser.rpc('is_board_member', { check_board_id: boardId });
      if (memberError || member !== true) return json({ error: 'Unauthorized' }, 401);
      scheduled = false;
      alertsOnly = false;
    }
    const now = new Date();

    let rulesQuery = admin.from('task_automation_rules').select('id, board_id, task_id, trigger_type, trigger_config, action_type, action_config').eq('is_active', true);
    if (boardId) rulesQuery = rulesQuery.eq('board_id', boardId);
    const { data: rulesRaw, error: rulesError } = await rulesQuery;
    const rules = alertsOnly ? [] : rulesRaw;
    if (rulesError) throw rulesError;

    const boardIds = [...new Set((rules ?? []).map((r) => r.board_id).filter(Boolean))];
    let tasksQuery = admin.from('tasks').select('id, title, task_number, assigned_to, board_id, due_date, updated_at, status, is_archived').eq('is_archived', false);
    if (boardIds.length) tasksQuery = tasksQuery.in('board_id', boardIds);
    if (boardId) tasksQuery = tasksQuery.eq('board_id', boardId);
    // the alerts-only cron run needs no rule tasks (it loads only the members' open tasks below)
    const { data: tasks = [], error: tasksError } = alertsOnly ? { data: [] as any[], error: null } : await tasksQuery;
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

    // Team alerts (Gestão de Pessoas > Alertas): each team chooses hours (:00/:30), weekdays, alert types and
    // whether the supervisor also gets a Comunicados message. Only scheduled runs (cron every 30 min) create them.
    const typesOf = new Map<string, Set<string>>();           // member profile -> alert types wanted by any of their due teams
    const dueTeams: any[] = [];
    if (scheduled) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(now).map((p) => [p.type, p.value]));
      const slot = `${parts.hour === '24' ? '00' : parts.hour}:${Number(parts.minute) < 30 ? '00' : '30'}`;
      const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
      const { data: teamRows = [] } = await admin.from('teams').select('id, name, supervisor_id, company_id, alert_times, alert_days, alert_types, alert_chat').eq('alerts_enabled', true);
      for (const t of teamRows as any[]) if ((t.alert_days ?? []).includes(dow) && (t.alert_times ?? []).includes(slot)) dueTeams.push(t);
      if (dueTeams.length) {
        const { data: mem = [] } = await admin.from('supervisor_team_members').select('team_id, member_profile_id').in('team_id', dueTeams.map((t) => t.id));
        const byId = new Map(dueTeams.map((t) => [t.id, t]));
        for (const m of mem as any[]) {
          const t = byId.get(m.team_id); if (!t) continue;
          (t.members ??= []).push(m.member_profile_id);
          const set = typesOf.get(m.member_profile_id) ?? new Set<string>();
          for (const ty of t.alert_types ?? []) set.add(ty);
          typesOf.set(m.member_profile_id, set);
        }
      }
    }
    if (scheduled && typesOf.size) {
      const ids = [...typesOf.keys()];
      const open: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data = [] } = await admin.from('tasks').select('id, title, task_number, assigned_to, board_id, due_date, updated_at').in('assigned_to', ids.slice(i, i + 200)).eq('is_archived', false).eq('is_template', false).is('completed_at', null).limit(5000);
        open.push(...(data as any[]));
      }
      const wants = (p: string, ty: string) => typesOf.get(p)?.has(ty) ?? false;
      const counts = new Map<string, { count: number; board_id: string | null }>();
      for (const task of open) {
        const p = task.assigned_to; if (!p) continue;
        const current = counts.get(p) ?? { count: 0, board_id: task.board_id }; current.count++; counts.set(p, current);
        if (task.due_date) {
          const overdue = now.getTime() - new Date(task.due_date).getTime();
          if (overdue > 0) { if (wants(p, 'late_task')) alerts.push({ profile_id: p, board_id: task.board_id, alert_type: 'late_task', message: `Card #${task.task_number} "${task.title}" está atrasado`, task_id: task.id }); }
          else if (overdue > -48 * 36e5 && wants(p, 'deadline_risk')) alerts.push({ profile_id: p, board_id: task.board_id, alert_type: 'deadline_risk', message: `Card #${task.task_number} "${task.title}" vence em breve`, task_id: task.id });
        }
        if (wants(p, 'stuck_task') && (now.getTime() - new Date(task.updated_at).getTime()) / 864e5 >= 3) alerts.push({ profile_id: p, board_id: task.board_id, alert_type: 'stuck_task', message: `Card #${task.task_number} "${task.title}" está parado há 3 dias ou mais`, task_id: task.id });
      }
      for (const [profile_id, value] of counts) if (value.count >= 5 && wants(profile_id, 'overloaded')) alerts.push({ profile_id, board_id: value.board_id, alert_type: 'overloaded', message: `Colaborador com ${value.count} cards em aberto — possível sobrecarga`, task_id: null });
    }
    const validAlerts = alerts.filter(Boolean);
    if (notificationRows.length) await admin.from('user_notifications').insert(notificationRows);
    if (validAlerts.length) {
      const keys = new Set(validAlerts.map((a) => `${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      const { data: existing = [] } = await admin.from('workload_alerts').select('profile_id, alert_type, task_id').in('profile_id', [...new Set(validAlerts.map((a) => a.profile_id))]).gte('created_at', new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString());
      const existingKeys = new Set((existing as any[]).map((a) => `${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      const fresh = validAlerts.filter((a) => keys.has(`${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`) && !existingKeys.has(`${a.profile_id}:${a.alert_type}:${a.task_id ?? 'none'}`));
      if (fresh.length) await admin.from('workload_alerts').insert(fresh);
      // "Chat do ewvon" channel: one Comunicados message per due team to its supervisor, only when there is something new
      if (fresh.length && dueTeams.length) {
        const LBL: Record<string, string> = { late_task: 'tarefa(s) atrasada(s)', deadline_risk: 'tarefa(s) vencendo em até 2 dias', stuck_task: 'tarefa(s) parada(s) há 3+ dias', overloaded: 'pessoa(s) com 5+ cards em aberto' };
        const sups = [...new Set(dueTeams.filter((t) => t.alert_chat).map((t) => t.supervisor_id))];
        const { data: supRows = [] } = sups.length ? await admin.from('profiles').select('id, user_id, company_id').in('user_id', sups) : { data: [] };
        const dms: any[] = [];
        for (const t of dueTeams) {
          if (!t.alert_chat || !(t.members ?? []).length) continue;
          const sup = (supRows as any[]).find((r) => r.user_id === t.supervisor_id && r.company_id === t.company_id); if (!sup) continue;
          const mine = fresh.filter((a) => t.members.includes(a.profile_id) && (t.alert_types ?? []).includes(a.alert_type));
          if (!mine.length) continue;
          const by = new Map<string, number>(); mine.forEach((a) => by.set(a.alert_type, (by.get(a.alert_type) ?? 0) + 1));
          const lines = [...by].map(([k, n]) => `• ${n} ${LBL[k] ?? k}`).join('\n');
          dms.push({ sender_id: '00000000-0000-0000-0000-0000000000c1', receiver_id: sup.id, company_id: t.company_id, content: `*Alertas da equipe ${t.name}*\n\n${lines}\n\nVeja os detalhes em Gestão de Pessoas > Alertas.` });
        }
        if (dms.length) await admin.from('direct_messages').insert(dms);
      }
    }
    return json({ processed, alerts: validAlerts.length });
  } catch (error) { console.error('Error processing automations:', error); return json({ error: 'Erro interno do servidor' }, 500); }
});
