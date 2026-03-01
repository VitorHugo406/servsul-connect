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

        // Build title with date info
        let titlePrefix = '[Cópia]'
        if (dup.frequency === 'daily') {
          const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          titlePrefix = `[Cópia ${dateStr}]`
        } else if (dup.frequency === 'monthly') {
          const monthStr = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          titlePrefix = `[Cópia ${monthStr}]`
        }

        const { error: insertError } = await supabase
          .from('tasks')
          .insert({
            title: `${titlePrefix} ${task.title}`,
            description: task.description,
            status: dup.target_column_id,
            priority: task.priority,
            assigned_to: task.assigned_to,
            board_id: dup.board_id,
            created_by: dup.created_by,
            cover_image: task.cover_image,
            due_date: task.due_date,
            position: count || 0,
          })

        if (!insertError) {
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
