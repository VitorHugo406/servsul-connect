import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Accept optional board_id filter for instant processing
    let filterBoardId: string | null = null;
    try {
      const body = await req.json();
      filterBoardId = body?.board_id || null;
    } catch { /* no body = process all */ }

    let processed = 0;
    const alerts: any[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // ===== PART 1: Process automation rules (SE → ENTÃO) =====
    let rulesQuery = adminClient
      .from('task_automation_rules')
      .select('*')
      .eq('is_active', true);
    
    if (filterBoardId) {
      rulesQuery = rulesQuery.eq('board_id', filterBoardId);
    }

    const { data: rules, error: rulesError } = await rulesQuery;

    if (rulesError) throw rulesError;

    for (const rule of (rules || [])) {
      const taskFilter = rule.task_id
        ? adminClient.from('tasks').select('*').eq('id', rule.task_id).eq('is_archived', false)
        : adminClient.from('tasks').select('*').eq('board_id', rule.board_id).eq('is_archived', false);

      const { data: tasks } = await taskFilter;
      if (!tasks || tasks.length === 0) continue;

      for (const task of tasks) {
        let triggered = false;

        switch (rule.trigger_type) {
          case 'deadline_approaching': {
            if (!task.due_date) break;
            const due = new Date(task.due_date);
            const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
            const threshold = rule.trigger_config?.hours || 24;
            triggered = hoursLeft > 0 && hoursLeft <= threshold;
            break;
          }
          case 'stuck_days': {
            const updated = new Date(task.updated_at);
            const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
            const threshold = rule.trigger_config?.days || 3;
            triggered = daysSinceUpdate >= threshold;
            break;
          }
          case 'checklist_complete': {
            const { data: subtasks } = await adminClient
              .from('task_subtasks')
              .select('is_completed')
              .eq('task_id', task.id);
            if (subtasks && subtasks.length > 0) {
              triggered = subtasks.every(s => s.is_completed);
            }
            break;
          }
          case 'label_urgent': {
            const { data: labelAssignments } = await adminClient
              .from('task_label_assignments')
              .select('label_id, task_labels(name)')
              .eq('task_id', task.id);
            if (labelAssignments) {
              triggered = labelAssignments.some((la: any) =>
                la.task_labels?.name?.toLowerCase().includes('urgent') ||
                la.task_labels?.name?.toLowerCase().includes('urgente')
              );
            }
            break;
          }
        }

        if (!triggered) continue;

        // Execute action
        switch (rule.action_type) {
          case 'notify': {
            if (task.assigned_to) {
              const { data: profile } = await adminClient
                .from('profiles')
                .select('user_id, display_name, name')
                .eq('id', task.assigned_to)
                .single();
              
              if (profile) {
                await adminClient.from('user_notifications').insert({
                  user_id: profile.user_id,
                  type: 'automation',
                  title: 'Automação ativada',
                  message: `Regra "${rule.trigger_type}" ativada no card #${task.task_number} "${task.title}"`,
                  reference_id: task.id,
                });
                processed++;
              }
            }
            break;
          }
          case 'move_column': {
            const targetCol = rule.action_config?.column_id;
            if (targetCol && task.status !== targetCol) {
              await adminClient.from('tasks').update({ status: targetCol, position: 0 }).eq('id', task.id);
              processed++;
            }
            break;
          }
          case 'set_priority': {
            const newPriority = rule.action_config?.priority;
            if (newPriority && task.priority !== newPriority) {
              await adminClient.from('tasks').update({ priority: newPriority }).eq('id', task.id);
              processed++;
            }
            break;
          }
          case 'alert': {
            if (task.assigned_to) {
              alerts.push({
                profile_id: task.assigned_to,
                board_id: rule.board_id,
                alert_type: rule.trigger_type === 'deadline_approaching' ? 'deadline_risk' :
                            rule.trigger_type === 'stuck_days' ? 'stuck_task' : 'late_task',
                message: `Card #${task.task_number} "${task.title}" - ${
                  rule.trigger_type === 'deadline_approaching' ? 'Prazo se aproximando' :
                  rule.trigger_type === 'stuck_days' ? 'Card parado por muito tempo' :
                  'Ação necessária'
                }`,
                task_id: task.id,
              });
              processed++;
            }
            break;
          }
        }
      }
    }

    // ===== PART 2: Auto-detect overdue and approaching deadline tasks =====
    let activeTasksQuery = adminClient
      .from('tasks')
      .select('id, title, task_number, assigned_to, board_id, due_date, updated_at, status')
      .eq('is_archived', false)
      .not('assigned_to', 'is', null);
    
    if (filterBoardId) {
      activeTasksQuery = activeTasksQuery.eq('board_id', filterBoardId);
    }

    const { data: allActiveTasks } = await activeTasksQuery;

    if (allActiveTasks) {
      const userTaskCounts: Record<string, { count: number; boards: Set<string> }> = {};

      for (const t of allActiveTasks) {
        if (!t.assigned_to) continue;
        
        // Count tasks per user for overload detection
        if (!userTaskCounts[t.assigned_to]) userTaskCounts[t.assigned_to] = { count: 0, boards: new Set() };
        userTaskCounts[t.assigned_to].count++;
        if (t.board_id) userTaskCounts[t.assigned_to].boards.add(t.board_id);

        // Check overdue tasks (due_date in the past)
        if (t.due_date) {
          const due = new Date(t.due_date);
          const hoursOverdue = (now.getTime() - due.getTime()) / (1000 * 60 * 60);
          
          if (hoursOverdue > 0) {
            // Task is overdue
            const daysOverdue = Math.ceil(hoursOverdue / 24);
            alerts.push({
              profile_id: t.assigned_to,
              board_id: t.board_id,
              alert_type: 'late_task',
              message: `Card #${t.task_number} "${t.title}" está atrasado há ${daysOverdue} dia(s)`,
              task_id: t.id,
            });
          } else if (hoursOverdue > -48) {
            // Task approaching deadline (within 48h)
            const hoursLeft = Math.ceil(Math.abs(hoursOverdue));
            alerts.push({
              profile_id: t.assigned_to,
              board_id: t.board_id,
              alert_type: 'deadline_risk',
              message: `Card #${t.task_number} "${t.title}" vence em ${hoursLeft}h`,
              task_id: t.id,
            });
          }
        }

        // Check stuck tasks (not updated in 3+ days)
        const daysSinceUpdate = (now.getTime() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate >= 3) {
          alerts.push({
            profile_id: t.assigned_to,
            board_id: t.board_id,
            alert_type: 'stuck_task',
            message: `Card #${t.task_number} "${t.title}" está parado há ${Math.floor(daysSinceUpdate)} dia(s)`,
            task_id: t.id,
          });
        }
      }

      // Overload detection (5+ active cards per user)
      for (const [profileId, data] of Object.entries(userTaskCounts)) {
        if (data.count >= 5) {
          alerts.push({
            profile_id: profileId,
            board_id: [...data.boards][0] || null,
            alert_type: 'overloaded',
            message: `Colaborador com ${data.count} cards ativos — possível sobrecarga`,
            task_id: null,
          });
        }
      }
    }

    // ===== PART 3: Insert alerts (deduplicate by checking recent) =====
    for (const alert of alerts) {
      let query = adminClient
        .from('workload_alerts')
        .select('id')
        .eq('profile_id', alert.profile_id)
        .eq('alert_type', alert.alert_type)
        .gte('created_at', oneHourAgo)
        .limit(1);
      
      if (alert.task_id) {
        query = query.eq('task_id', alert.task_id);
      } else {
        query = query.is('task_id', null);
      }
      
      const { data: existing } = await query;

      if (!existing || existing.length === 0) {
        await adminClient.from('workload_alerts').insert(alert);
      }
    }

    return new Response(
      JSON.stringify({ processed, alerts: alerts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing automations:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
