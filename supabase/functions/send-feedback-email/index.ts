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
    recommendations.push('Sua participação nas conversas foi baixa este mês. Tente interagir mais com a equipe para manter a comunicação fluida.')
  } else if (stats.totalMessages > 50) {
    recommendations.push('Excelente nível de comunicação! Continue mantendo esse engajamento com a equipe.')
  }

  if (stats.totalTasks > 0) {
    const completionRate = stats.completedTasks / stats.totalTasks
    if (completionRate >= 0.9) {
      recommendations.push('Parabéns! Sua taxa de conclusão de tarefas está excelente. Continue assim!')
    } else if (completionRate >= 0.6) {
      recommendations.push('Sua taxa de conclusão de tarefas está boa, mas há espaço para melhoria. Tente priorizar as tarefas com prazo mais próximo.')
    } else {
      recommendations.push('Sua taxa de conclusão de tarefas está abaixo do ideal. Considere revisar suas prioridades e pedir ajuda quando necessário.')
    }
  } else {
    recommendations.push('Nenhuma tarefa foi atribuída a você este mês. Verifique com seu supervisor se há atividades pendentes.')
  }

  if (stats.lateTasks > 0) {
    recommendations.push(`Você teve ${stats.lateTasks} entrega(s) com atraso. Planeje melhor os prazos e avise antecipadamente caso precise de mais tempo.`)
  }

  if (stats.overdueTasks > 0) {
    recommendations.push(`Existem ${stats.overdueTasks} tarefa(s) pendentes e atrasadas. Priorize resolvê-las o mais rápido possível.`)
  }

  if (stats.lateTasks === 0 && stats.overdueTasks === 0 && stats.totalTasks > 0) {
    recommendations.push('Nenhuma tarefa atrasada! Ótima gestão de tempo.')
  }

  return recommendations
}

function buildChatMessage(displayName: string, stats: any, recommendations: string[], currentMonth: string, pdfUrl?: string): string {
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
      msg += `• ${r}\n`
    })
  }

  if (pdfUrl) {
    msg += `\n📎 [Relatório PDF - ${currentMonth}](${pdfUrl})`
  }

  msg += `\n\n_Mensagem automática do ServChat_`
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

// Build an SVG-based PDF content as HTML that we convert to a downloadable report
function buildPdfHtml(displayName: string, stats: any, recommendations: string[], currentMonth: string, companyName: string): string {
  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0
  const pendingTasks = stats.totalTasks - stats.completedTasks
  
  // SVG pie chart for task completion
  const completedAngle = (stats.completedTasks / Math.max(stats.totalTasks, 1)) * 360
  const completedRad = (completedAngle - 90) * Math.PI / 180
  const largeArc = completedAngle > 180 ? 1 : 0
  const x = 50 + 40 * Math.cos(completedRad)
  const y = 50 + 40 * Math.sin(completedRad)
  
  const pieChart = stats.totalTasks > 0 ? `
    <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" fill="#e5e7eb"/>
      ${stats.completedTasks > 0 && stats.completedTasks < stats.totalTasks ? `
        <path d="M 50 10 A 40 40 0 ${largeArc} 1 ${x.toFixed(1)} ${y.toFixed(1)} L 50 50 Z" fill="#22c55e"/>
      ` : stats.completedTasks >= stats.totalTasks ? `
        <circle cx="50" cy="50" r="40" fill="#22c55e"/>
      ` : ''}
      <circle cx="50" cy="50" r="20" fill="white"/>
      <text x="50" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2937">${completionRate}%</text>
    </svg>
  ` : '<svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#e5e7eb"/><circle cx="50" cy="50" r="20" fill="white"/><text x="50" y="54" text-anchor="middle" font-size="10" fill="#9ca3af">N/A</text></svg>'

  // Bar chart for messages
  const maxBar = Math.max(stats.totalMessages, stats.completedTasks, stats.lateTasks, stats.overdueTasks, 1)
  const barHeight = (val: number) => Math.max((val / maxBar) * 80, 2)

  const barChart = `
    <svg width="260" height="120" viewBox="0 0 260 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="${120 - barHeight(stats.totalMessages)}" width="40" height="${barHeight(stats.totalMessages)}" rx="4" fill="#3b82f6"/>
      <text x="40" y="${115 - barHeight(stats.totalMessages)}" text-anchor="middle" font-size="9" fill="#1f2937" font-weight="bold">${stats.totalMessages}</text>
      <text x="40" y="118" text-anchor="middle" font-size="7" fill="#6b7280">Msgs</text>
      
      <rect x="80" y="${120 - barHeight(stats.completedTasks)}" width="40" height="${barHeight(stats.completedTasks)}" rx="4" fill="#22c55e"/>
      <text x="100" y="${115 - barHeight(stats.completedTasks)}" text-anchor="middle" font-size="9" fill="#1f2937" font-weight="bold">${stats.completedTasks}</text>
      <text x="100" y="118" text-anchor="middle" font-size="7" fill="#6b7280">Concluídas</text>
      
      <rect x="140" y="${120 - barHeight(stats.lateTasks)}" width="40" height="${barHeight(stats.lateTasks)}" rx="4" fill="#f59e0b"/>
      <text x="160" y="${115 - barHeight(stats.lateTasks)}" text-anchor="middle" font-size="9" fill="#1f2937" font-weight="bold">${stats.lateTasks}</text>
      <text x="160" y="118" text-anchor="middle" font-size="7" fill="#6b7280">Atrasadas</text>
      
      <rect x="200" y="${120 - barHeight(stats.overdueTasks)}" width="40" height="${barHeight(stats.overdueTasks)}" rx="4" fill="#ef4444"/>
      <text x="220" y="${115 - barHeight(stats.overdueTasks)}" text-anchor="middle" font-size="9" fill="#1f2937" font-weight="bold">${stats.overdueTasks}</text>
      <text x="220" y="118" text-anchor="middle" font-size="7" fill="#6b7280">Pendentes</text>
    </svg>
  `

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: white; color: #1f2937; }
  
  .header {
    background: linear-gradient(135deg, #1e40af, #3b82f6);
    padding: 40px 48px;
    color: white;
  }
  .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .header p { opacity: 0.85; font-size: 14px; }
  .header .subtitle { font-size: 18px; margin-top: 8px; opacity: 0.95; }
  
  .content { padding: 32px 48px; }
  
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 32px;
  }
  .stat-card {
    border-radius: 12px;
    padding: 20px 16px;
    text-align: center;
    border: 1px solid;
  }
  .stat-card.green { background: #f0fdf4; border-color: #bbf7d0; }
  .stat-card.blue { background: #eff6ff; border-color: #bfdbfe; }
  .stat-card.yellow { background: #fffbeb; border-color: #fde68a; }
  .stat-card.red { background: #fef2f2; border-color: #fecaca; }
  .stat-value { font-size: 32px; font-weight: 700; }
  .stat-card.green .stat-value { color: #16a34a; }
  .stat-card.blue .stat-value { color: #2563eb; }
  .stat-card.yellow .stat-value { color: #d97706; }
  .stat-card.red .stat-value { color: #dc2626; }
  .stat-label { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  .charts-section {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
    align-items: flex-start;
  }
  .chart-box {
    flex: 1;
    background: #f8fafc;
    border-radius: 12px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    text-align: center;
  }
  .chart-box h3 { font-size: 14px; color: #374151; margin-bottom: 12px; font-weight: 600; }
  
  .recommendations {
    background: #f8fafc;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    margin-bottom: 32px;
  }
  .recommendations h3 { font-size: 16px; color: #1e40af; margin-bottom: 16px; font-weight: 600; }
  .rec-item {
    padding: 10px 16px;
    background: white;
    border-radius: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #374151;
    border-left: 3px solid #3b82f6;
  }
  
  .footer {
    text-align: center;
    padding: 24px 48px;
    color: #9ca3af;
    font-size: 11px;
    border-top: 1px solid #e5e7eb;
  }
  
  .legend {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 8px;
    font-size: 10px;
    color: #6b7280;
  }
  .legend-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>ServChat</h1>
    <p>${companyName}</p>
    <div class="subtitle">📊 Relatório Mensal de Atividades — ${currentMonth}</div>
  </div>
  
  <div class="content">
    <p style="font-size: 16px; margin-bottom: 24px; color: #374151;">
      Colaborador: <strong>${displayName}</strong>
    </p>
    
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-value">${stats.totalMessages}</div>
        <div class="stat-label">Mensagens Enviadas</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">${stats.completedTasks}/${stats.totalTasks}</div>
        <div class="stat-label">Tarefas Concluídas</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-value">${stats.lateTasks}</div>
        <div class="stat-label">Entregas com Atraso</div>
      </div>
      <div class="stat-card red">
        <div class="stat-value">${stats.overdueTasks}</div>
        <div class="stat-label">Pendências Atrasadas</div>
      </div>
    </div>
    
    <div class="charts-section">
      <div class="chart-box">
        <h3>Taxa de Conclusão de Tarefas</h3>
        ${pieChart}
        <div class="legend">
          <span><span class="legend-dot" style="background:#22c55e"></span>Concluídas (${stats.completedTasks})</span>
          <span><span class="legend-dot" style="background:#e5e7eb"></span>Pendentes (${pendingTasks})</span>
        </div>
      </div>
      <div class="chart-box">
        <h3>Visão Geral de Atividades</h3>
        ${barChart}
      </div>
    </div>
    
    ${recommendations.length > 0 ? `
    <div class="recommendations">
      <h3>📌 Recomendações Personalizadas</h3>
      ${recommendations.map(r => `<div class="rec-item">${r}</div>`).join('')}
    </div>
    ` : ''}
  </div>
  
  <div class="footer">
    Relatório gerado automaticamente pelo ServChat em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
    © ${new Date().getFullYear()} ${companyName}. Todos os direitos reservados.
  </div>
</body>
</html>`
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
    let sentPdfCount = 0
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

        // Generate PDF HTML and upload to storage
        let pdfUrl: string | undefined
        try {
          const pdfHtml = buildPdfHtml(displayName, stats, recommendations, currentMonth, companyName)
          const monthSlug = currentMonth.replace(/\s+/g, '-').toLowerCase()
          const fileName = `feedback/${monthSlug}/${profile.id}.html`
          
          const htmlBlob = new Blob([pdfHtml], { type: 'text/html' })
          
          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(fileName, htmlBlob, {
              contentType: 'text/html',
              upsert: true,
            })

          if (uploadError) {
            console.error(`PDF upload error for ${profile.name}:`, uploadError)
          } else {
            const { data: urlData } = supabase.storage
              .from('attachments')
              .getPublicUrl(fileName)
            pdfUrl = urlData?.publicUrl
            sentPdfCount++
            console.log(`PDF uploaded for ${profile.name}: ${pdfUrl}`)
          }
        } catch (pdfErr) {
          console.error(`PDF generation error for ${profile.name}:`, pdfErr)
        }

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
            const chatMessage = buildChatMessage(displayName, stats, recommendations, currentMonth, pdfUrl)
            
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

    console.log(`Feedback complete: ${sentEmailCount} emails, ${sentDmCount} DMs, ${sentPdfCount} PDFs sent to ${targetProfiles.length} users. Errors: ${errors.length}`)

    return new Response(JSON.stringify({ 
      success: true, 
      emailCount: sentEmailCount,
      dmCount: sentDmCount,
      pdfCount: sentPdfCount,
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
