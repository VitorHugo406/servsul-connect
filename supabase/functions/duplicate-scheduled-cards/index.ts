import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all active duplications
    const { data: duplications, error: dupError } = await supabase
      .from('task_auto_duplications')
      .select('*, task:tasks(*)')
      .eq('is_active', true)

    if (dupError) throw dupError

    const now = new Date()
    const currentDayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const currentDayOfMonth = now.getDate()
    let duplicated = 0

    for (const dup of duplications || []) {
      if (!dup.task) continue

      const lastDup = dup.last_duplicated_at ? new Date(dup.last_duplicated_at) : null
      let shouldDuplicate = false

      if (!lastDup) {
        shouldDuplicate = true
      } else {
        const diffMs = now.getTime() - lastDup.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (dup.frequency === 'daily' && diffHours >= 23) {
          shouldDuplicate = true
        } else if (dup.frequency === 'weekly' && diffDays >= 6.5) {
          shouldDuplicate = true
        } else if (dup.frequency === 'monthly' && diffDays >= 28) {
          shouldDuplicate = true
        }
      }

      // For daily frequency, check if current weekday is in the allowed list
      if (shouldDuplicate && dup.frequency === 'daily' && dup.weekdays && dup.weekdays.length > 0) {
        if (!dup.weekdays.includes(currentDayOfWeek)) {
          shouldDuplicate = false
        }
      }

      // For monthly frequency, check if current day matches the specified month_day
      if (shouldDuplicate && dup.frequency === 'monthly' && dup.month_day) {
        if (currentDayOfMonth !== dup.month_day) {
          shouldDuplicate = false
        }
      }

      if (shouldDuplicate) {
        const task = dup.task
        // Get count of tasks in target column for position
        const { count } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('board_id', dup.board_id)
          .eq('status', dup.target_column_id)

        // Check if target column has auto-assign automation
        const { data: targetColumn } = await supabase
          .from('task_board_columns')
          .select('auto_assign_to, auto_cover, is_conclusion')
          .eq('id', dup.target_column_id)
          .single()

        // Build title with date info
        let titlePrefix = '[Cópia]'
        if (dup.frequency === 'daily') {
          const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          titlePrefix = `[Cópia ${dateStr}]`
        } else if (dup.frequency === 'monthly') {
          const monthStr = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          titlePrefix = `[Cópia ${monthStr}]`
        }

        // Apply column automation for assigned_to if available
        const assignedTo = targetColumn?.auto_assign_to || task.assigned_to
        const coverImage = targetColumn?.auto_cover || task.cover_image

        // For daily frequency, set due_date to today with the original task's time
        let newDueDate = task.due_date
        if (dup.frequency === 'daily' && task.due_date) {
          const originalDue = new Date(task.due_date)
          const todayDue = new Date(now)
          todayDue.setHours(originalDue.getHours(), originalDue.getMinutes(), originalDue.getSeconds(), 0)
          newDueDate = todayDue.toISOString()
        }

        const { data: newTask, error: insertError } = await supabase
          .from('tasks')
          .insert({
            title: `${titlePrefix} ${task.title}`,
            description: task.description,
            status: dup.target_column_id,
            priority: task.priority,
            assigned_to: assignedTo,
            board_id: dup.board_id,
            created_by: dup.created_by,
            cover_image: coverImage,
            due_date: newDueDate,
            position: count || 0,
          })
          .select('id')
          .single()

        if (!insertError && newTask) {
          // Copy subtasks
          const { data: subtasks } = await supabase
            .from('task_subtasks')
            .select('title, position')
            .eq('task_id', task.id)
          
          if (subtasks && subtasks.length > 0) {
            await supabase.from('task_subtasks').insert(
              subtasks.map((s: any) => ({ task_id: newTask.id, title: s.title, position: s.position }))
            )
          }

          // Copy task assignees
          const { data: assignees } = await supabase
            .from('task_assignees')
            .select('profile_id')
            .eq('task_id', task.id)
          
          if (assignees && assignees.length > 0) {
            await supabase.from('task_assignees').insert(
              assignees.map((a: any) => ({ task_id: newTask.id, profile_id: a.profile_id }))
            )
          }

          await supabase
            .from('task_auto_duplications')
            .update({ last_duplicated_at: now.toISOString() })
            .eq('id', dup.id)
          duplicated++
        }
      }
    }

    return new Response(JSON.stringify({ success: true, duplicated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})