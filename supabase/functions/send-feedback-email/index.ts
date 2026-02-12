import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

async function getAdminProfileId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error('Error getting admin profile:', error)
    throw new Error('Could not find admin profile')
  }

  return data.id
}

function generateRecommendations(stats: {
  totalMessages: number
  completedTasks: number
  totalTasks: number
  lateTasks: number
  overdueTasks: number
}): string[] {
  const recommendations: string[] = []

  if (stats.totalMessages < 5) {
    recommendations.push('📬 Sua participação nas conversas foi baixa este mês. Tente interagir mais com a equipe para manter a comunicação fluida.')
  } else if (stats.totalMessages > 50) {
    recommendations.push('🌟 Excelente nível de comunicação! Continue mantendo esse engajamento com a equipe.')
  }

  if (stats.totalTasks > 0) {
    const completionRate = stats.completedTasks / stats.totalTasks
    if (completionRate >= 0.9) {
      recommendations.push('🏆 Parabéns! Sua taxa de conclusão de tarefas está excelente. Continue assim!')
    } else if (completionRate >= 0.6) {
      recommendations.push('📊 Sua taxa de conclusão de tarefas está boa, mas há espaço para melhoria. Tente priorizar as tarefas com prazo mais próximo.')
    } else {
      recommendations.push('⚠️ Sua taxa de conclusão de tarefas está abaixo do ideal. Considere revisar suas prioridades e pedir ajuda quando necessário.')
    }
  } else {
    recommendations.push('📋 Nenhuma tarefa foi atribuída a você este mês. Verifique com seu supervisor se há atividades pendentes.')
  }

  if (stats.lateTasks > 0) {
    recommendations.push(`⏰ Você teve ${stats.lateTasks} entrega(s) com atraso. Planeje melhor os prazos e avise antecipadamente caso precise de mais tempo.`)
  }

  if (stats.overdueTasks > 0) {
    recommendations.push(`🔴 Existem ${stats.overdueTasks} tarefa(s) pendentes e atrasadas. Priorize resolvê-las o mais rápido possível.`)
  }

  if (stats.lateTasks === 0 && stats.overdueTasks === 0 && stats.totalTasks > 0) {
    recommendations.push('✅ Nenhuma tarefa atrasada! Ótima gestão de tempo.')
  }

  return recommendations
}

function buildChatMessage(displayName: string, stats: any, recommendations: string[], currentMonth: string): string {
  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0

  let msg = `📊 *Feedback Mensal — ${currentMonth}*\n\n`
  msg += `Olá, *${displayName}*! Aqui está o seu resumo mensal:\n\n`
  msg += `💬 Mensagens enviadas: *${stats.totalMessages}*\n`
  msg += `✅ Tarefas concluídas: *${stats.completedTasks}/${stats.totalTasks}* (${completionRate}%)\n`
  msg += `⏰ Entregas com atraso: *${stats.lateTasks}*\n`
  msg += `🔴 Pendências atrasadas: *${stats.overdueTasks}*\n\n`

  if (recommendations.length > 0) {
    msg += `📌 *Recomendações:*\n`
    recommendations.forEach(r => {
      msg += `${r}\n`
    })
  }

  msg += `\n_Mensagem automática do ServChat_`
  return msg
}

function buildEmailHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string): string {
  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px 16px 0 0;padding:40px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;">ServChat</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${companyName}</p>
    </div>
    <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
      <h2 style="color:#1f2937;margin:0 0 8px;font-size:22px;">📊 Feedback Mensal — ${currentMonth}</h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">Olá, <strong>${displayName}</strong>! Aqui está o resumo da sua atividade este mês.</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;border:1px solid #bbf7d0;">
          <p style="color:#16a34a;font-size:28px;font-weight:700;margin:0;">${stats.totalMessages}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Mensagens Enviadas</p>
        </div>
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #bfdbfe;">
          <p style="color:#2563eb;font-size:28px;font-weight:700;margin:0;">${stats.completedTasks}/${stats.totalTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Concluídas</p>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
        <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:12px;padding:16px;text-align:center;border:1px solid #fecaca;">
          <p style="color:#dc2626;font-size:28px;font-weight:700;margin:0;">${stats.lateTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Entregas com Atraso</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:12px;padding:16px;text-align:center;border:1px solid #fed7aa;">
          <p style="color:#ea580c;font-size:28px;font-weight:700;margin:0;">${stats.overdueTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Pendentes Atrasadas</p>
        </div>
      </div>
      ${recommendations.length > 0 ? `
      <div style="background:#f8fafc;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #e2e8f0;">
        <h3 style="color:#374151;margin:0 0 12px;font-size:16px;">📌 Recomendações:</h3>
        <ul style="color:#4b5563;margin:0;padding:0 0 0 20px;line-height:1.8;">
          ${recommendations.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      <div style="text-align:center;padding:16px 0;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Este e-mail foi enviado automaticamente pelo sistema ServChat.<br>© ${new Date().getFullYear()} ${companyName}. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if admin
    const userId = user.id
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { type, targetUserId } = body

    console.log(`Feedback request: type=${type}, targetUserId=${targetUserId}`)

    // Use admin profile as DM sender
    const senderProfileId = await getAdminProfileId(supabase, userId)

    // Get target profiles
    let targetProfiles: any[] = []
    if (type === 'individual' && targetUserId) {
      // Individual: fetch ONLY the specific user by profile id
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email')
        .eq('id', targetUserId)
        .single()
      
      if (profileError) {
        console.error('Error fetching target profile:', profileError)
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (data) targetProfiles = [data]
      console.log(`Individual target: ${data?.name} (${data?.id})`)
    } else if (type === 'all') {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, name, display_name, email')
        .eq('is_active', true)
        .neq('profile_type', 'bot')
      targetProfiles = data || []
      console.log(`All targets: ${targetProfiles.length} users`)
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type. Use "individual" or "all".' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (targetProfiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const companyName = 'Grupo Servsul'
    const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    let sentEmailCount = 0
    let sentDmCount = 0
    const errors: string[] = []

    for (const profile of targetProfiles) {
      try {
        // Don't send DM to self
        if (profile.id === senderProfileId) {
          console.log(`Skipping DM to self (admin): ${profile.name}`)
        }

        // Fetch stats
        const { count: sectorMsgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        const { count: dmCount } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', profile.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, status, completed_at, completed_late, due_date')
          .eq('assigned_to', profile.id)

        const totalTasks = tasksData?.length || 0
        const completedTasks = tasksData?.filter((t: any) => t.completed_at)?.length || 0
        const lateTasks = tasksData?.filter((t: any) => t.completed_late === true)?.length || 0
        const overdueTasks = tasksData?.filter((t: any) => {
          if (t.completed_at) return false
          if (!t.due_date) return false
          return new Date(t.due_date) < now
        })?.length || 0

        const totalMessages = (sectorMsgCount || 0) + (dmCount || 0)
        const displayName = profile.display_name || profile.name

        const stats = { totalMessages, completedTasks, totalTasks, lateTasks, overdueTasks }
        const recommendations = generateRecommendations(stats)

        // 1. Try to send email
        if (resendApiKey && profile.email) {
          try {
            const resend = new Resend(resendApiKey)
            const emailHtml = buildEmailHtml(displayName, stats, recommendations, currentMonth, companyName)

            const { error: sendError } = await resend.emails.send({
              from: 'ServChat <onboarding@resend.dev>',
              to: [profile.email],
              subject: `📊 Feedback Mensal — ${currentMonth}`,
              html: emailHtml,
            })

            if (!sendError) {
              sentEmailCount++
              console.log(`Email sent to ${profile.email}`)
            } else {
              console.error(`Email error for ${profile.email}:`, sendError)
            }
          } catch (emailErr) {
            console.error(`Email exception for ${profile.email}:`, emailErr)
          }
        }

        // 2. Always send DM (even if email failed), but skip sending to self
        if (profile.id !== senderProfileId) {
          try {
            const chatMessage = buildChatMessage(displayName, stats, recommendations, currentMonth)
            
            const { error: dmError } = await supabase
              .from('direct_messages')
              .insert({
                sender_id: senderProfileId,
                receiver_id: profile.id,
                content: chatMessage,
              })

            if (dmError) {
              console.error(`DM error for ${profile.name}:`, dmError)
              errors.push(`DM ${profile.name}: ${dmError.message}`)
            } else {
              sentDmCount++
              console.log(`DM sent to ${profile.name}`)
            }
          } catch (dmErr) {
            console.error(`DM exception for ${profile.name}:`, dmErr)
            errors.push(`DM ${profile.name}: ${dmErr instanceof Error ? dmErr.message : 'unknown'}`)
          }
        }

      } catch (userError) {
        console.error(`Error processing ${profile.name}:`, userError)
        errors.push(`${profile.name}: ${userError instanceof Error ? userError.message : 'unknown'}`)
      }
    }

    console.log(`Feedback complete: ${sentEmailCount} emails, ${sentDmCount} DMs sent to ${targetProfiles.length} users. Errors: ${errors.length}`)

    return new Response(JSON.stringify({ 
      success: true, 
      emailCount: sentEmailCount,
      dmCount: sentDmCount,
      total: targetProfiles.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in send-feedback:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
