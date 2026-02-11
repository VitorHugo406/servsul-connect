import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SYSTEM_BOT_EMAIL = 'sistema@servchat.bot'
const SYSTEM_BOT_NAME = 'ServChat Bot'

async function getOrCreateBotProfile(supabase: any) {
  // Check if bot profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, user_id')
    .eq('email', SYSTEM_BOT_EMAIL)
    .eq('profile_type', 'bot')
    .single()

  if (existing) return existing.id

  // Create a deterministic UUID for the bot user_id
  const botUserId = '00000000-0000-0000-0000-000000000099'

  const { data: newBot, error } = await supabase
    .from('profiles')
    .insert({
      user_id: botUserId,
      name: SYSTEM_BOT_NAME,
      display_name: '🤖 ServChat Bot',
      email: SYSTEM_BOT_EMAIL,
      profile_type: 'bot',
      is_active: true,
      autonomy_level: 'colaborador',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating bot profile:', error)
    throw new Error('Could not create bot profile')
  }

  return newBot.id
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

function buildPdfHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string): string {
  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0
  const pendingTasks = stats.totalTasks - stats.completedTasks

  // SVG bar chart for tasks
  const barWidth = 400
  const completedBarW = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * barWidth) : 0
  const lateBarW = stats.totalTasks > 0 ? Math.round((stats.lateTasks / stats.totalTasks) * barWidth) : 0
  const overdueBarW = stats.totalTasks > 0 ? Math.round((stats.overdueTasks / stats.totalTasks) * barWidth) : 0

  // SVG donut chart for completion
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const completedArc = (completionRate / 100) * circumference
  const remainingArc = circumference - completedArc

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a2e; padding: 40px; }
  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 32px; border-radius: 16px; margin-bottom: 32px; }
  .header h1 { font-size: 28px; margin-bottom: 4px; }
  .header p { opacity: 0.85; font-size: 14px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; border-left: 4px solid #6366f1; padding-left: 12px; }
  .stats-grid { display: flex; gap: 16px; flex-wrap: wrap; }
  .stat-card { flex: 1; min-width: 140px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
  .stat-card .number { font-size: 36px; font-weight: 800; }
  .stat-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .green { color: #16a34a; }
  .blue { color: #2563eb; }
  .red { color: #dc2626; }
  .orange { color: #ea580c; }
  .chart-container { display: flex; align-items: center; justify-content: center; gap: 40px; margin: 20px 0; }
  .bar-chart { width: 100%; max-width: 500px; }
  .bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .bar-label { width: 120px; font-size: 13px; text-align: right; color: #475569; }
  .bar-bg { flex: 1; height: 24px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; transition: width 0.3s; }
  .bar-value { width: 40px; font-size: 13px; font-weight: 600; }
  .recommendations { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; }
  .recommendations ul { list-style: none; padding: 0; }
  .recommendations li { padding: 8px 0; font-size: 14px; line-height: 1.6; border-bottom: 1px solid #dcfce7; }
  .recommendations li:last-child { border-bottom: none; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
  <div class="header">
    <h1>📊 Feedback Mensal — ${currentMonth}</h1>
    <p>${displayName} • Grupo Servsul</p>
  </div>

  <div class="section">
    <div class="section-title">Visão Geral</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="number blue">${stats.totalMessages}</div>
        <div class="label">Mensagens Enviadas</div>
      </div>
      <div class="stat-card">
        <div class="number green">${stats.completedTasks}</div>
        <div class="label">Tarefas Concluídas</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.totalTasks}</div>
        <div class="label">Total de Tarefas</div>
      </div>
      <div class="stat-card">
        <div class="number orange">${stats.lateTasks}</div>
        <div class="label">Entregas Atrasadas</div>
      </div>
      <div class="stat-card">
        <div class="number red">${stats.overdueTasks}</div>
        <div class="label">Pendências Atrasadas</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Gráfico de Desempenho</div>
    <div class="chart-container">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="16"/>
        <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#22c55e" stroke-width="16"
          stroke-dasharray="${completedArc} ${remainingArc}" 
          stroke-dashoffset="${circumference * 0.25}"
          stroke-linecap="round"/>
        <text x="90" y="85" text-anchor="middle" font-size="28" font-weight="800" fill="#1e293b">${completionRate}%</text>
        <text x="90" y="105" text-anchor="middle" font-size="11" fill="#64748b">Conclusão</text>
      </svg>
      <div class="bar-chart">
        <div class="bar-row">
          <div class="bar-label">Concluídas</div>
          <div class="bar-bg"><div class="bar-fill" style="width:${stats.totalTasks > 0 ? (stats.completedTasks/stats.totalTasks*100) : 0}%;background:#22c55e;"></div></div>
          <div class="bar-value green">${stats.completedTasks}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">Pendentes</div>
          <div class="bar-bg"><div class="bar-fill" style="width:${stats.totalTasks > 0 ? (pendingTasks/stats.totalTasks*100) : 0}%;background:#3b82f6;"></div></div>
          <div class="bar-value blue">${pendingTasks}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">Com atraso</div>
          <div class="bar-bg"><div class="bar-fill" style="width:${stats.totalTasks > 0 ? (stats.lateTasks/stats.totalTasks*100) : 0}%;background:#f59e0b;"></div></div>
          <div class="bar-value orange">${stats.lateTasks}</div>
        </div>
        <div class="bar-row">
          <div class="bar-label">Atrasadas</div>
          <div class="bar-bg"><div class="bar-fill" style="width:${stats.totalTasks > 0 ? (stats.overdueTasks/stats.totalTasks*100) : 0}%;background:#ef4444;"></div></div>
          <div class="bar-value red">${stats.overdueTasks}</div>
        </div>
      </div>
    </div>
  </div>

  ${recommendations.length > 0 ? `
  <div class="section">
    <div class="section-title">Recomendações</div>
    <div class="recommendations">
      <ul>
        ${recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  </div>
  ` : ''}

  <div class="footer">
    Relatório gerado automaticamente pelo ServChat • ${new Date().toLocaleDateString('pt-BR')} • © ${new Date().getFullYear()} Grupo Servsul
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

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if admin
    const userId = claims.claims.sub as string
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').single()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { type, targetUserId } = body

    // Get or create bot profile for DMs
    const botProfileId = await getOrCreateBotProfile(supabase)

    // Get target profiles
    let targetProfiles: any[] = []
    if (type === 'individual' && targetUserId) {
      const { data } = await supabase.from('profiles').select('id, user_id, name, display_name, email').eq('id', targetUserId).single()
      if (data) targetProfiles = [data]
    } else if (type === 'all') {
      const { data } = await supabase.from('profiles').select('id, user_id, name, display_name, email').eq('is_active', true).neq('profile_type', 'bot')
      targetProfiles = data || []
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
        let emailSent = false
        if (resendApiKey && profile.email) {
          try {
            const resend = new Resend(resendApiKey)
            const pdfHtml = buildPdfHtml(displayName, stats, recommendations, currentMonth)

            const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
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
          <p style="color:#16a34a;font-size:28px;font-weight:700;margin:0;">${totalMessages}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Mensagens Enviadas</p>
        </div>
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:12px;padding:16px;text-align:center;border:1px solid #bfdbfe;">
          <p style="color:#2563eb;font-size:28px;font-weight:700;margin:0;">${completedTasks}/${totalTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Tarefas Concluídas</p>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 24px;">
        <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:12px;padding:16px;text-align:center;border:1px solid #fecaca;">
          <p style="color:#dc2626;font-size:28px;font-weight:700;margin:0;">${lateTasks}</p>
          <p style="color:#4b5563;font-size:12px;margin:4px 0 0;">Entregas com Atraso</p>
        </div>
        <div style="flex:1;min-width:120px;background:#fff7ed;border-radius:12px;padding:16px;text-align:center;border:1px solid #fed7aa;">
          <p style="color:#ea580c;font-size:28px;font-weight:700;margin:0;">${overdueTasks}</p>
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

            const { error: sendError } = await resend.emails.send({
              from: 'ServChat <onboarding@resend.dev>',
              to: [profile.email],
              subject: `📊 Feedback Mensal — ${currentMonth}`,
              html: emailHtml,
            })

            if (!sendError) {
              emailSent = true
              sentEmailCount++
              console.log(`Email sent to ${profile.email}`)
            } else {
              console.error(`Email error for ${profile.email}:`, sendError)
            }
          } catch (emailErr) {
            console.error(`Email exception for ${profile.email}:`, emailErr)
          }
        }

        // 2. Always send DM from bot (even if email succeeded)
        try {
          const chatMessage = buildChatMessage(displayName, stats, recommendations, currentMonth)
          
          const { error: dmError } = await supabase
            .from('direct_messages')
            .insert({
              sender_id: botProfileId,
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

      } catch (userError) {
        console.error(`Error processing ${profile.name}:`, userError)
        errors.push(`${profile.name}: ${userError instanceof Error ? userError.message : 'unknown'}`)
      }
    }

    console.log(`Feedback: ${sentEmailCount} emails, ${sentDmCount} DMs sent to ${targetProfiles.length} users. Errors: ${errors.length}`)

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
